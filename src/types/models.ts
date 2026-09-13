export interface VocabWord {
  id: string;
  originalGerman: string; // dạng đầy đủ, có thể chứa "/" cho biến thể số nhiều
  mainGerman: string; // dạng chính dùng để so khớp
  meaning: string; // nghĩa tiếng Việt
  wordType: string; // n, v, adj, ...
  example?: string; // câu ví dụ tiếng Đức
  sortOrder?: number;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  folderId?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
  parentId?: string | null;
}
