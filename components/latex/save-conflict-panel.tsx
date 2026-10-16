"use client";
import { useState } from "react";
import type { SaveConflict } from "@/lib/file-save-manager";

export function SaveConflictPanel({ conflict, name, refresh, resolve, edit }: {
  conflict: SaveConflict; name: string;
  refresh: (id: string) => Promise<void>;
  resolve: (id: string, revision: number, content: string) => Promise<void>;
  edit: (id: string, content: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : "Conflict resolution failed"); }
    finally { setBusy(false); }
  };
  return <section className="p-3 border-b border-amber-500/30 space-y-2 text-xs" aria-label={`Resolve conflict in ${name}`}>
    <p className="text-amber-300">{name}: saving and compilation are blocked until you choose the intended content.</p>
    <div className="grid grid-cols-2 gap-2">
      <label>Local edits<textarea className="w-full h-24 bg-black font-mono select-text" readOnly value={conflict.local} /></label>
      <label>Server revision {conflict.revision}<textarea className="w-full h-24 bg-black font-mono select-text" readOnly value={conflict.server} /></label>
    </div>
    <label>Reconcile local content (kept in the recovery draft)<textarea disabled={busy} className="w-full h-24 bg-black font-mono select-text" value={conflict.local} onChange={e => {
      try { edit(conflict.id, e.target.value); } catch (error) { setError(error instanceof Error ? error.message : "Could not edit this file"); }
    }} /></label>
    <div className="flex gap-3">
      <button disabled={busy} onClick={() => void run(() => refresh(conflict.id))}>Refresh server</button>
      <button disabled={busy} onClick={() => void run(() => resolve(conflict.id, conflict.revision, conflict.local))}>Save reviewed local content</button>
      <button disabled={busy} onClick={() => void run(() => resolve(conflict.id, conflict.revision, conflict.server))}>Use server content (discard local)</button>
    </div>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
  </section>;
}
