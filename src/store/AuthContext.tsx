import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeToAuthState, logout as firebaseLogout, getDisplayName } from '@/services/firebase/auth';

export interface AuthUser {
  uid: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /** Called right after a successful login/register screen flow. */
  setSessionUser: (u: AuthUser, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Mirrors localStorage keys "loggedUser"/"loggedUid" from index.html (kept for parity/debugging)
const REMEMBER_KEY = 'beitl_remember_me';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /**
     * index.html waits for Firebase's own onAuthStateChanged before deciding
     * whether to show the app or redirect to Login.html — Firebase restores
     * the session from its own persistence automatically. We replicate that
     * here: no manual "logged in" flag needed for the happy path.
     *
     * DEVIATION from the original: the web version distinguishes
     * localStorage (remember me checked) vs sessionStorage (remember me
     * unchecked, cleared when the browser tab closes). React Native has no
     * equivalent of "tab closed" — the closest analogue is "app fully
     * closed". So: if the user did NOT check "remember me", we sign them out
     * once on the first cold start after that login, simulating a session
     * that doesn't survive an app restart. If they DID check it, Firebase's
     * AsyncStorage persistence keeps them logged in indefinitely, same as
     * localStorage on web.
     */
    let unsub: (() => void) | undefined;

    (async () => {
      const remembered = await AsyncStorage.getItem(REMEMBER_KEY);
      unsub = subscribeToAuthState(async (fbUser) => {
        if (fbUser) {
          if (remembered === 'false') {
            await AsyncStorage.removeItem(REMEMBER_KEY);
            await firebaseLogout();
            setUser(null);
          } else {
            const displayName = await getDisplayName(fbUser.uid, fbUser.email ?? 'Người dùng');
            setUser({ uid: fbUser.uid, displayName });
          }
        } else {
          setUser(null);
        }
        setIsLoading(false);
      });
    })();

    return () => unsub?.();
  }, []);

  const setSessionUser = async (u: AuthUser, remember: boolean) => {
    await AsyncStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
    setUser(u);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(REMEMBER_KEY);
    await firebaseLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, setSessionUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
