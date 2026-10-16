/** Optional browser preference; independent of editor selection and project default. */
export function readCompileTarget(projectId: string, files: { id: string; path: string }[], fallback: string | null): string | null {
  try {
    const id = window.localStorage.getItem(`resume_eng_compile_target:${projectId}`);
    return files.some(file => file.id === id && file.path.toLowerCase().endsWith(".tex")) ? id : fallback;
  } catch { return fallback; }
}
export function writeCompileTarget(projectId: string, fileId: string): void {
  try { window.localStorage.setItem(`resume_eng_compile_target:${projectId}`, fileId); } catch { /* Preference storage is optional. */ }
}
