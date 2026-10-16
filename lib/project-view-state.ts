/** Browser-local preferences only: never content, revisions, or compiler entry configuration. */
export interface ProjectViewState {
  activeFileId: string | null;
  expandedFolderIds: string[];
}

export const projectViewKey = (projectId: string) => `resume_eng_project_view_v1:${encodeURIComponent(projectId)}`;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FOLDERS = 50000;
const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 512;
const copy = (state: ProjectViewState): ProjectViewState => ({ ...state, expandedFolderIds: [...state.expandedFolderIds] });
type ViewStorage = Pick<Storage, "getItem" | "setItem">;

export class ProjectViewStateStore {
  private readonly memory = new Map<string, ProjectViewState>();

  constructor(private readonly storage: () => ViewStorage | undefined = () =>
    typeof window === "undefined" ? undefined : window.localStorage) {}

  read(projectId: string): ProjectViewState | undefined {
    const cached = this.memory.get(projectId);
    if (cached) return copy(cached);
    try {
      const raw = this.storage()?.getItem(projectViewKey(projectId));
      if (!raw || raw.length * 2 > MAX_BYTES) return undefined;
      const value = JSON.parse(raw);
      if (!value || value.version !== 1 || value.projectId !== projectId ||
          !(value.activeFileId === null || validId(value.activeFileId)) ||
          !Array.isArray(value.expandedFolderIds) || value.expandedFolderIds.length > MAX_FOLDERS ||
          !value.expandedFolderIds.every(validId)) return undefined;
      const state = { activeFileId: value.activeFileId, expandedFolderIds: [...new Set<string>(value.expandedFolderIds)] };
      this.memory.set(projectId, state);
      return copy(state);
    } catch {
      // Preferences are optional. Blocked storage or corrupt data must not prevent editing.
      return undefined;
    }
  }

  save(projectId: string, state: ProjectViewState): void {
    this.memory.set(projectId, copy(state));
    try {
      const raw = JSON.stringify({ version: 1, projectId, ...state });
      if (state.expandedFolderIds.length <= MAX_FOLDERS && raw.length * 2 <= MAX_BYTES) {
        this.storage()?.setItem(projectViewKey(projectId), raw);
      }
    } catch {
      // Keep session preferences in memory when browser storage is unavailable or full.
    }
  }
}

export function reconcileProjectViewState(
  state: ProjectViewState | undefined,
  files: readonly { id: string }[],
  folders: readonly { id: string }[],
): ProjectViewState {
  const folderIds = new Set(folders.map(folder => folder.id));
  return {
    activeFileId: files.some(file => file.id === state?.activeFileId) ? state!.activeFileId : files[0]?.id ?? null,
    expandedFolderIds: [...new Set(state?.expandedFolderIds ?? [])].filter(id => folderIds.has(id)),
  };
}
