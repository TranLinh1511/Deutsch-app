import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import AuthStack from './AuthStack';
import AppDrawer from './AppDrawer';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/theme/ThemeContext';

/**
 * Auth vs App navigation switch. `isLoading` mirrors the original's
 * `_authReady` promise — index.html doesn't render anything meaningful
 * until Firebase's onAuthStateChanged fires once; we show a blank spinner
 * screen for that same brief window instead of flashing the Login screen.
 */
export default function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { mode, colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color="#58a6ff" />
      </View>
    );
  }

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.bg2,
      text: colors.tx,
      border: colors.border,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <AppDrawer /> : <AuthStack />}
    </NavigationContainer>
  );
}
