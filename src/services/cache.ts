import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin async wrapper mirroring the localStorage.getItem/setItem/removeItem
 * calls scattered through index.html (cache_sessions_*, vocab_*,
 * cache_mastered_*, cache_flagged_*, sessionFolders). Kept as plain
 * JSON string keys so the naming stays 1:1 with the original for easy
 * cross-reference — only the storage backend and sync→async shape differ.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort cache, never block the caller
  }
}

export async function cacheRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Mirrors bootstrap()'s startup cleanup of stale vocab_/cache_mastered_/cache_flagged_ keys */
export async function clearStaleVocabCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter(
      (k) => k.startsWith('vocab_') || k.startsWith('cache_mastered_') || k.startsWith('cache_flagged_')
    );
    if (stale.length) await AsyncStorage.multiRemove(stale);
  } catch {
    // ignore
  }
}
