import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

/** Login.html: toFakeEmail(username) — Firebase cần email nên map username → email nội bộ */
export function toFakeEmail(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, '_') + '@beitl.app';
}

export class AuthFieldError extends Error {
  field: 'username' | 'password' | 'name' | 'confirm';
  constructor(field: AuthFieldError['field'], message: string) {
    super(message);
    this.field = field;
  }
}

/** Login.html: doLogin() — trả về { uid, displayName } sau khi xác thực + đọc users/{uid} */
export async function login(username: string, password: string) {
  const u = username.trim();
  const p = password;
  if (!u) throw new AuthFieldError('username', 'Vui lòng nhập tên đăng nhập');
  if (!p) throw new AuthFieldError('password', 'Vui lòng nhập mật khẩu');

  const email = toFakeEmail(u);
  const cred = await signInWithEmailAndPassword(auth, email, p);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));
  const displayName = snap.exists() ? (snap.data().name as string) : u;
  return { uid: cred.user.uid, displayName };
}

/** Login.html: doRegister() — cùng thứ tự validate y hệt bản gốc */
export async function register(name: string, username: string, password: string, confirm: string) {
  const n = name.trim();
  const u = username.trim();

  if (!n) throw new AuthFieldError('name', 'Vui lòng nhập họ tên');
  if (!u) throw new AuthFieldError('username', 'Vui lòng nhập tên đăng nhập');
  if (u.length < 3) throw new AuthFieldError('username', 'Tên đăng nhập tối thiểu 3 ký tự');
  if (!password) throw new AuthFieldError('password', 'Vui lòng nhập mật khẩu');
  if (password.length < 6) throw new AuthFieldError('password', 'Mật khẩu tối thiểu 6 ký tự');
  if (password !== confirm) throw new AuthFieldError('confirm', 'Mật khẩu xác nhận không khớp');

  try {
    const email = toFakeEmail(u);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      name: n,
      username: u,
      createdAt: Date.now(),
    });
    return { uid: cred.user.uid, displayName: n };
  } catch (e: any) {
    if (e?.code === 'auth/email-already-in-use') {
      throw new AuthFieldError('username', 'Tên đăng nhập đã tồn tại');
    }
    throw e;
  }
}

/**
 * Login.html: doFindUser() — thực tế bản gốc gửi reset email trực tiếp,
 * KHÔNG có bước nhập mật khẩu mới thật sự hoạt động (forgotStep2/resetPwBtn
 * trong Login.html không có listener nối logic thật). Giữ đúng hành vi
 * thật của bản gốc: 1 bước duy nhất — gửi email đặt lại mật khẩu.
 */
export async function sendResetEmail(username: string) {
  const u = username.trim();
  if (!u) throw new AuthFieldError('username', 'Vui lòng nhập tên đăng nhập');
  try {
    await sendPasswordResetEmail(auth, toFakeEmail(u));
  } catch {
    throw new AuthFieldError('username', 'Không tìm thấy tài khoản này');
  }
}

export function subscribeToAuthState(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function logout() {
  await firebaseSignOut(auth);
}

export async function getDisplayName(uid: string, fallback: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data().name as string) : fallback;
}
