/**
 * Bus nhỏ báo "dữ liệu nền vừa làm tươi xong và KHÁC với bản cache đã hiển thị".
 * Dùng cho stale-while-revalidate: UI hiện cache ngay lập tức, còn khi bản
 * tải từ Firestore về khác cache thì DataStore nghe sự kiện này để cập nhật.
 */
export type RevalidateKind = 'vocab' | 'mastered' | 'flagged' | 'sessions';
type Listener = (kind: RevalidateKind, sid: string) => void;

const listeners = new Set<Listener>();

export function onRevalidated(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitRevalidated(kind: RevalidateKind, sid: string) {
  listeners.forEach((l) => l(kind, sid));
}
