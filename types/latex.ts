export interface LatexFolderItem {
  id: string;
  projectId: string;
  name: string;
  path: string;
  parentFolderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LatexFileItem {
  id: string;
  name: string;
  path: string;
  content: string;
  folderId?: string | null;
  language?: string;
  lineCount?: number;
  isUploaded?: boolean;
  createdAt?: string;
  updatedAt?: string;
  isEntryFile?: boolean;
}

export type UploadStatus = "idle" | "uploading" | "success" | "error";
