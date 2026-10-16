const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

import { LatexFileItem, LatexFolderItem } from "@/types/latex";

/**
 * Helper to execute fetch requests with network error handling.
 * Throws a user-friendly error when the backend server is offline/unreachable.
 */
async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (
      err instanceof TypeError ||
      (err as Error)?.name === "TypeError" ||
      (err as Error)?.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        `Unable to connect to backend server at ${API_URL}. Please ensure the backend server is running.`
      );
    }
    throw err;
  }
}

export interface UploadLatexProjectData {
  id: string;
  name: string;
  compiler: string;
  createdAt?: string;
  updatedAt?: string;
  entryFileId?: string | null;
}

export interface UploadLatexFileData {
  id: string;
  name: string;
  path: string;
  content: string;
  contentRevision?: number;
  recoveryPending?: boolean;
  folderId?: string | null;
  lineCount?: number;
  language?: string;
}

export interface UploadLatexResponse {
  success: boolean;
  message: string;
  data: {
    project: UploadLatexProjectData;
    file: UploadLatexFileData;
  };
}

export interface ApiErrorResponse {
  success: false;
  message: string;
}

export interface ProjectFilesResponseData {
  files: LatexFileItem[];
  folders: LatexFolderItem[];
}

/**
 * Uploads a .tex file to the backend API.
 * Uses multipart/form-data with the 'file' field.
 * Optionally passes existing projectId to import into current project.
 */
export async function uploadLatexFile(
  file: File,
  projectId?: string
): Promise<UploadLatexResponse> {
  if (!file.name.toLowerCase().endsWith(".tex")) {
    throw new Error("Invalid file type. Only .tex files can be uploaded.");
  }

  const formData = new FormData();
  formData.append("file", file);
  if (projectId) {
    formData.append("projectId", projectId);
  }

  const response = await safeFetch(`${API_URL}/api/latex/upload`, {
    method: "POST",
    body: formData,
  });

  let data: UploadLatexResponse | ApiErrorResponse;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Server returned unexpected response (status ${response.status})`);
  }

  if (!response.ok || !data.success) {
    const errorMessage = data.message || `Upload failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as UploadLatexResponse;
}

/**
 * Fetches the most recently uploaded/edited LaTeX file and project from MongoDB.
 */
export async function fetchLatestLatexFile(): Promise<UploadLatexResponse["data"] | null> {
  try {
    const response = await safeFetch(`${API_URL}/api/latex/latest`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) return null;
    const json = await response.json();
    if (json.success && json.data) {
      if (!json.data.project?.id || !json.data.file?.id) return null;
      return json.data;
    }
    return null;
  } catch (err) {
    console.error("fetchLatestLatexFile error:", err);
    return null;
  }
}

/**
 * Creates a new LaTeX project in MongoDB.
 */
export async function createLatexProject(name: string): Promise<UploadLatexProjectData> {
  const response = await safeFetch(`${API_URL}/api/latex/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Failed to create project (status ${response.status})`);
  }

  return json.data.project;
}

/**
 * Fetches project metadata.
 */
export async function fetchLatexProject(
  projectId: string
): Promise<UploadLatexProjectData> {
  const response = await safeFetch(`${API_URL}/api/latex/projects/${projectId}`, {
    method: "GET",
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Failed to fetch project (status ${response.status})`);
  }

  return json.data.project;
}

export async function setLatexProjectEntryFile(
  projectId: string,
  entryFileId: string
): Promise<string> {
  const response = await safeFetch(`${API_URL}/api/latex/projects/${projectId}/entry-file`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryFileId }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Failed to set entry file (status ${response.status})`);
  }
  return json.data.project.entryFileId;
}

/**
 * Lists all files and folders in a project.
 */
export async function fetchProjectFiles(
  projectId: string
): Promise<ProjectFilesResponseData> {
  const response = await safeFetch(`${API_URL}/api/latex/projects/${projectId}/files`, {
    method: "GET",
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success || !Array.isArray(json.data?.files) || !Array.isArray(json.data?.folders)) {
    throw new Error(json?.message || `Failed to fetch project files (status ${response.status})`);
  }
  return {
    files: (json.data?.files ?? []).map((f: LatexFileItem) => ({
      ...f,
      content: f.content ?? "",
      contentLoaded: false,
      lineCount: f.lineCount ?? 0,
    })),
    folders: json.data?.folders ?? [],
  };
}

/**
 * Fetches a single LaTeX file including its full content.
 */
export async function fetchLatexFile(
  fileId: string
): Promise<UploadLatexFileData | null> {
  try {
    const response = await safeFetch(`${API_URL}/api/latex/files/${fileId}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) return null;
    const json = await response.json();
    return json.data?.file ? { ...json.data.file, contentLoaded: true } : null;
  } catch (err) {
    console.error("fetchLatexFile error:", err);
    return null;
  }
}

/**
 * Creates a new file in a project.
 */
export async function createLatexFile(
  projectId: string,
  name: string,
  folderId?: string | null
): Promise<LatexFileItem> {
  const response = await safeFetch(`${API_URL}/api/latex/projects/${projectId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folderId: folderId ?? null }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Failed to create file (status ${response.status})`);
  }

  return { ...json.data.file, contentLoaded: true };
}

/**
 * Creates a new folder in a project.
 */
export async function createLatexFolder(
  projectId: string,
  name: string,
  parentFolderId?: string | null
): Promise<LatexFolderItem> {
  const response = await safeFetch(`${API_URL}/api/latex/projects/${projectId}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parentFolderId: parentFolderId ?? null }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Failed to create folder (status ${response.status})`);
  }

  return json.data.folder;
}

/**
 * Deletes a file.
 */
export async function deleteLatexFile(fileId: string, expectedRevision: number): Promise<void> {
  const response = await safeFetch(`${API_URL}/api/latex/files/${fileId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.message || `Failed to delete file (status ${response.status})`);
  }
}

/**
 * Deletes a folder.
 * If folder is not empty, server returns 409 Conflict.
 */
export async function deleteLatexFolder(folderId: string): Promise<void> {
  const response = await safeFetch(`${API_URL}/api/latex/folders/${folderId}`, {
    method: "DELETE",
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Failed to delete folder (status ${response.status})`);
  }
}

/**
 * Renames a file.
 */
export async function renameLatexFile(
  fileId: string,
  name: string
): Promise<LatexFileItem> {
  const response = await safeFetch(`${API_URL}/api/latex/files/${fileId}/name`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Failed to rename file (status ${response.status})`);
  }

  return json.data.file;
}

/**
 * Renames a folder.
 */
export async function renameLatexFolder(
  folderId: string,
  name: string
): Promise<LatexFolderItem> {
  const response = await safeFetch(`${API_URL}/api/latex/folders/${folderId}/name`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || `Failed to rename folder (status ${response.status})`);
  }

  return json.data.folder;
}

/**
 * PATCHes the content of a LaTeX file in MongoDB.
 * Saves a snapshot only if its expected content revision is still current.
 * A 409 conflict leaves local buffers intact; never retry with a guessed revision.
 */
export async function updateLatexFile(
  fileId: string,
  content: string,
  expectedRevision: number
): Promise<{ contentRevision: number; content?: string; recoveryPending?: boolean }> {
  const response = await safeFetch(`${API_URL}/api/latex/files/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, expectedRevision }),
  });

  if (!response.ok) {
    let msg = `Save failed (status ${response.status})`;
    try {
      const json = await response.json();
      if (json.message) msg = json.message;
    } catch {
      // ignore parse error
    }
    throw Object.assign(new Error(msg), { status: response.status });
  }
  const json = await response.json();
  return { contentRevision: json.data.file.contentRevision, content: json.data.file.content, recoveryPending: json.data.file.recoveryPending };
}

// Alias for updateLatexFile to maintain backward compatibility
export const patchLatexFile = updateLatexFile;

export interface AcceptedTailoringSuggestion {
  suggestionId: string;
  status: "accepted";
  fileId: string;
  fileName: string;
  changedLineStart: number;
  changedLineEnd: number;
  updatedContent: string;
  contentRevision: number;
  recoveryPending?: boolean;
  pdfStale: true;
}

export async function acceptTailoringSuggestion(
  suggestionId: string,
  projectId: string,
  versionId: string
): Promise<AcceptedTailoringSuggestion> {
  const response = await safeFetch(`${API_URL}/api/tailoring/suggestions/${encodeURIComponent(suggestionId)}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    const code = json?.error?.code || json?.code;
    throw new Error(code ? `${code}: ${json?.error?.message || json?.message}` : (json?.message || `Failed to apply suggestion (status ${response.status})`));
  }
  return json.data as AcceptedTailoringSuggestion;
}

export interface CompileErrorItem {
  severity: "error" | "warning";
  file: string | null;
  line: number | null;
  message: string;
}

export interface SourceCaptureMetadata {
  version: 1; hash: string; capturedAt: string; entryFileId: string; sourceVersion: number; treeVersion: number;
  files: { fileId: string; path: string; folderId: string | null; contentRevision: number; sha256: string; byteLength: number }[];
  folders: { folderId: string; path: string; parentFolderId: string | null }[];
}

export interface CompileProjectResult {
  compilationId: string;
  projectId: string;
  entryFileId: string;
  entryFilePath: string;
  sourceCapture?: SourceCaptureMetadata;
  status: "success" | "failed" | "timeout";
  durationMs: number;
  pdf?: {
    fileName: string;
    url: string;
  };
  errors: CompileErrorItem[];
  logs: {
    stdout: string;
    stderr: string;
  };
  error?: {
    code: string;
    message: string;
  };
  pdfState?: PdfState;
}

export type PdfState = "none" | "valid" | "stale" | "failed-with-previous";

export interface CompilationState {
  state: PdfState;
  latest: CompileProjectResult | null;
  successful: CompileProjectResult | null;
  pdf: {
    fileName: string;
    url: string;
  } | null;
}

export interface CompilationBuild {
  _id: string; projectId: string; compiledEntryFileId?: string; mainFile: string;
  status: "success" | "failed" | "timeout"; sourceVersion: number; createdAt: string; durationMs: number;
  pdfPath?: string | null; stdout?: string; stderr?: string; compileErrors?: CompileErrorItem[];
  sourceCapture?: SourceCaptureMetadata;
}
export interface CompilationHistory { builds: CompilationBuild[]; page: number; hasMore: boolean }
export async function fetchCompilationHistory(projectId: string, entryFileId: string, page = 1): Promise<CompilationHistory> {
  const response = await safeFetch(`${API_URL}/api/latex/projects/${projectId}/compilations?entryFileId=${encodeURIComponent(entryFileId)}&page=${page}`, { cache: "no-store" });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.message || "Could not load build history");
  return json.data;
}

export interface CompilerStatusData {
  available: boolean;
  compiler: string;
  version?: string;
  error?: string;
}

/**
 * Returns the URL for streaming the latest compiled PDF artifact.
 */
export function getLatexPdfUrl(projectId: string): string {
  return `${API_URL}/api/latex/projects/${projectId}/pdf`;
}

/**
 * Checks whether the configured LaTeX compiler is installed and available.
 */
export async function checkCompilerStatus(): Promise<CompilerStatusData> {
  try {
    const response = await safeFetch(`${API_URL}/api/latex/compiler/status`, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        available: false,
        compiler: "pdflatex",
        error: `Compiler status check failed (status ${response.status})`,
      };
    }
    const json = await response.json();
    return json.data;
  } catch (err) {
    console.error("checkCompilerStatus error:", err);
    return {
      available: false,
      compiler: "pdflatex",
      error: "Compiler status check failed because the backend is unreachable",
    };
  }
}

/**
 * Compiles an explicit project entry without changing the default. Omission uses
 * the configured default; invalid or missing targets fail without fallback.
 */
export async function compileLatexProject(
  projectId: string,
  entryFileId?: string
): Promise<CompileProjectResult> {
  const response = await safeFetch(`${API_URL}/api/latex/projects/${projectId}/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entryFileId !== undefined ? { entryFileId } : {}),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(
      json?.message ||
        json?.error?.message ||
        `Compilation request failed (status ${response.status})`
    );
  }

  return json.data as CompileProjectResult;
}

/**
 * Fetches the latest compilation record for a project.
 */
export async function fetchLatestCompilation(
  projectId: string, entryFileId?: string
): Promise<CompilationState | null> {
  try {
    const response = await safeFetch(
      `${API_URL}/api/latex/projects/${projectId}/compilation/latest${entryFileId ? `?entryFileId=${encodeURIComponent(entryFileId)}` : ""}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );
    if (!response.ok) throw new Error("Could not load compilation state");
    const json = await response.json();
    const normalize = (record: CompilationBuild | null) => record ? ({ ...record, compilationId: record._id,
      entryFileId: record.compiledEntryFileId ?? "", entryFilePath: record.mainFile, errors: record.compileErrors ?? [],
      logs: { stdout: record.stdout ?? "", stderr: record.stderr ?? "" } }) : null;
    return { ...json.data, latest: normalize(json.data.latest), successful: normalize(json.data.successful) };
  } catch (error) {
    throw error;
  }
}
