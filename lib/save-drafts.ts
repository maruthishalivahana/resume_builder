import type { Draft } from "./file-save-manager";
export const DRAFT_KEY = "resume_eng_pending_drafts_v1";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 100;
export function readDrafts(storage: Pick<Storage, "getItem">): Draft[] {
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) return [];
  if (raw.length * 2 > MAX_BYTES) throw new Error("Draft recovery exceeds the storage limit.");
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > MAX_FILES) throw new Error("Invalid draft recovery data.");
  if (!value.every(d => d && typeof d.id === "string" && typeof d.projectId === "string" && typeof d.content === "string" && typeof d.baseContent === "string" && Number.isSafeInteger(d.revision) && d.revision >= 0 && Number.isFinite(d.savedAt))) throw new Error("Invalid recovery drafts; stored data was retained.");
  return value as Draft[];
}
export function writeDrafts(storage: Pick<Storage, "setItem" | "removeItem">, drafts: Draft[]): void {
  const raw = JSON.stringify(drafts);
  if (drafts.length > MAX_FILES || raw.length * 2 > MAX_BYTES) throw new Error("Draft recovery limit reached (100 files / 2 MiB). Save or copy pending content before leaving.");
  if (drafts.length) storage.setItem(DRAFT_KEY, raw); else storage.removeItem(DRAFT_KEY);
}
