import AsyncStorage from '@react-native-async-storage/async-storage';

// index.html: SEARCH_HIST_KEY = "sidebarSearchHistory", SEARCH_HIST_MAX = 12
const KEY = 'sidebarSearchHistory';
const MAX = 12;

export async function getSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function pushSearchHistory(q: string): Promise<string[]> {
  if (!q || q.trim().length < 2) return getSearchHistory();
  let h = (await getSearchHistory()).filter((x) => x !== q);
  h.unshift(q);
  if (h.length > MAX) h = h.slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(h));
  return h;
}

export async function removeFromSearchHistory(q: string): Promise<string[]> {
  const next = (await getSearchHistory()).filter((x) => x !== q);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearSearchHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
