import { getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { vocabCol, vocabDoc } from './paths';
import { cacheGet, cacheSet, cacheRemove } from '@/services/cache';
import type { VocabWord } from '@/types/models';
import { emitRevalidated } from './revalidate';

// In-memory cache, mirrors _cache.vocab (sid -> array). Kept fresh by the
// realtime onSnapshot listener in realtimeSync.ts once a session is active.
const _vocabCache: Record<string, VocabWord[]> = {};

export function getVocabCacheEntry(sid: string) {
  return _vocabCache[sid];
}
export function setVocabCacheEntry(sid: string, data: VocabWord[]) {
  _vocabCache[sid] = data;
}

/** index.html: invalidateVocabCache(sid) */
export async function invalidateVocabCache(sid: string): Promise<void> {
  await cacheRemove(`vocab_${sid}`);
  delete _vocabCache[sid];
}

/**
 * index.html: dbGetSessionVocab(sid)
 *
 * Stale-while-revalidate: có cache (RAM hoặc AsyncStorage) → trả về NGAY để
 * UI hiện tức thì, rồi tải bản mới từ Firestore ở nền; nếu khác bản cache thì
 * báo qua emitRevalidated để DataStore cập nhật. Chỉ khi chưa có cache nào
 * (lần đầu cài app / đăng nhập máy mới) mới phải chờ mạng.
 */
export async function dbGetSessionVocab(uid: string, sid: string): Promise<VocabWord[]> {
  if (_vocabCache[sid]) return _vocabCache[sid];

  const fetchFresh = async (): Promise<VocabWord[]> => {
    const snap = await getDocs(query(vocabCol(uid, sid), orderBy('sortOrder', 'asc')));
    const result = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VocabWord);
    const before = _vocabCache[sid];
    _vocabCache[sid] = result;
    await cacheSet(`vocab_${sid}`, result);
    if (before && JSON.stringify(before) !== JSON.stringify(result)) emitRevalidated('vocab', sid);
    return result;
  };

  const cached = await cacheGet<VocabWord[]>(`vocab_${sid}`);
  if (cached) {
    _vocabCache[sid] = cached;
    fetchFresh().catch(() => {});
    return cached;
  }
  return fetchFresh();
}

/** index.html: dbAddWord(sid, word, order) */
export async function dbAddWord(uid: string, sid: string, word: VocabWord, order: number): Promise<void> {
  await setDoc(vocabDoc(uid, sid, word.id), {
    originalGerman: word.originalGerman,
    mainGerman: word.mainGerman,
    meaning: word.meaning,
    wordType: word.wordType || '',
    example: word.example || '',
    sortOrder: order || 0,
  });
  delete _vocabCache[sid];
  await invalidateVocabCache(sid);
}

/** index.html: dbUpdateWord(sid, id, g, main, m, wt, ex) */
export async function dbUpdateWord(
  uid: string,
  sid: string,
  id: string,
  originalGerman: string,
  mainGerman: string,
  meaning: string,
  wordType: string,
  example: string
): Promise<void> {
  await setDoc(
    vocabDoc(uid, sid, id),
    {
      originalGerman,
      mainGerman,
      meaning,
      wordType: wordType || '',
      example: example || '',
    },
    { merge: true }
  );
  delete _vocabCache[sid];
  await invalidateVocabCache(sid);
}

/** index.html: dbDeleteWord(sid, id) */
export async function dbDeleteWord(uid: string, sid: string, id: string): Promise<void> {
  await deleteDoc(vocabDoc(uid, sid, id));
  delete _vocabCache[sid];
  await invalidateVocabCache(sid);
}
