export type FileSaveStatus = "saved" | "saving" | "unsaved" | "error";
export type ServerFile = { content: string; contentRevision: number; recoveryPending?: boolean };
type FileSnapshot = { id: string; content: string; contentRevision?: number; contentLoaded?: boolean; recoveryPending?: boolean };
export type Draft = { id: string; projectId: string; content: string; revision: number; baseContent: string; savedAt: number };
export type SaveConflict = { id: string; local: string; server: string; revision: number };
type BufferState = {
  projectId: string; content: string; revision: number; baseContent: string; loaded: boolean;
  server: ServerFile; dirty: boolean; sequence: number; error?: Error; conflict?: boolean; deleting?: boolean;
  timer?: ReturnType<typeof setTimeout>; flight?: Promise<void>;
};
/** Local intent and the latest committed server snapshot are kept separately. */
export class FileSaveManager {
  private readonly buffers = new Map<string, BufferState>();
  private readonly recovered = new Map<string, Draft>();
  private active = true;
  private readonly operations = new Map<string, Promise<unknown>>();
  constructor(
    private readonly persist: (id: string, content: string, revision: number) => Promise<{ contentRevision: number; content?: string; recoveryPending?: boolean }>,
    private readonly changed: () => void = () => {},
    private readonly debounceMs = 1000,
    private readonly read?: (id: string) => Promise<ServerFile>,
  ) {}
  restore(drafts: Draft[]): void { drafts.forEach(d => this.recovered.set(d.id, d)); }
  private notify(): void { if (this.active) this.changed(); }
  activate(): void { this.active = true; }
  deactivate(): void {
    this.active = false;
    for (const b of this.buffers.values()) { if (b.timer) clearTimeout(b.timer); b.timer = undefined; }
  }
  publish(): void { this.notify(); }
  unopenedDrafts(projectId: string): Draft[] { return [...this.recovered.values()].filter(d => !projectId || d.projectId === projectId); }
  discardDraft(id: string): void { this.recovered.delete(id); this.notify(); }
  drafts(): Draft[] {
    return [...this.recovered.values(), ...[...this.buffers].filter(([, b]) => b.dirty).map(([id, b]) => ({
      id, projectId: b.projectId, content: b.content, revision: b.revision, baseContent: b.baseContent, savedAt: Date.now(),
    }))];
  }
  hasPending(): boolean { return this.operations.size > 0 || this.recovered.size > 0 || [...this.buffers.values()].some(b => b.dirty || b.flight || b.conflict || b.server.recoveryPending); }
  view<T extends FileSnapshot>(file: T): T {
    const b = this.buffers.get(file.id);
    return b ? { ...file, content: b.content, contentRevision: b.revision, contentLoaded: b.loaded, recoveryPending: b.server.recoveryPending } : file;
  }
  async serverOperation<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    return this.exclusive(projectId, async () => { await this.flushBuffers(projectId); return operation(); });
  }
  private async exclusive<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operations.get(projectId);
    const flight = Promise.resolve(previous).catch(() => {}).then(operation);
    this.operations.set(projectId, flight);
    this.notify();
    try { return await flight; } finally { if (this.operations.get(projectId) === flight) this.operations.delete(projectId); this.notify(); }
  }
  merge<T extends FileSnapshot>(file: T, projectId: string): T {
    let b = this.buffers.get(file.id);
    const revision = file.contentRevision ?? 0;
    if (!b) {
      b = { projectId, content: file.content, revision, baseContent: file.content, loaded: file.contentLoaded === true,
        server: { content: file.content, contentRevision: revision, recoveryPending: file.recoveryPending }, dirty: false, sequence: 0 };
      this.buffers.set(file.id, b);
    }
    if (file.contentLoaded && revision >= b.server.contentRevision) {
      b.server = { content: file.content, contentRevision: revision, recoveryPending: file.recoveryPending };
      if (!b.dirty && !b.flight) {
        b.content = file.content; b.baseContent = file.content; b.revision = revision;
        b.error = undefined; b.conflict = false;
      } else if (revision > b.revision && file.content !== b.baseContent) {
        b.conflict = true;
        b.error = new Error("Server content changed. Resolve the conflict before saving or compiling.");
      }
      b.loaded = true;
      const draft = this.recovered.get(file.id);
      if (draft && draft.projectId === projectId) {
        b.content = draft.content; b.revision = draft.revision; b.baseContent = draft.baseContent; b.dirty = true;
        b.conflict = true;
        b.error = new Error(revision !== draft.revision
          ? "Recovered draft differs from the current server revision. Resolve the conflict."
          : "Recovered local draft. Review it against the server before saving.");
        this.recovered.delete(file.id);
      }
    } else if (!file.contentLoaded && !b.dirty && !b.flight && revision > b.revision) b.loaded = false;
    return { ...file, content: b.content, contentRevision: b.revision, contentLoaded: b.loaded, recoveryPending: b.server.recoveryPending };
  }
  isDirty(id: string, projectId?: string): boolean {
    const b = this.buffers.get(id); return Boolean(b?.dirty && (!projectId || b.projectId === projectId));
  }
  conflicts(projectId: string): SaveConflict[] {
    return [...this.buffers].filter(([, b]) => b.projectId === projectId && b.conflict).map(([id, b]) => ({ id, local: b.content, server: b.server.content, revision: b.server.contentRevision }));
  }
  async refresh(id: string): Promise<void> {
    if (!this.read) throw new Error("Cannot load authoritative server content.");
    const b = this.buffers.get(id);
    if (!b) return;
    try {
      const server = await this.read(id);
      this.merge({ id, ...server, contentLoaded: true }, b.projectId); this.notify();
    } catch (error) {
      // An ambiguous committed write must remain a compile barrier until a read succeeds.
      b.conflict = true;
      b.error = error instanceof Error ? error : new Error("Cannot reconcile server content.");
      this.notify(); throw b.error;
    }
  }
  async resolve(id: string, revision: number, content: string): Promise<void> {
    const b = this.buffers.get(id);
    if (!b || !b.conflict) throw new Error("No unresolved conflict for this file.");
    if (!b.loaded) throw new Error("Load the file and review its content before resolving the conflict.");
    const sequence = b.sequence;
    if (b.flight) await b.flight.catch(() => {});
    await this.refresh(id);
    if (b.sequence !== sequence) throw new Error("Local edits changed during conflict resolution. Review them before choosing again.");
    if (b.server.contentRevision !== revision || b.server.recoveryPending) throw new Error("Server changed again or recovery is pending. Review the refreshed server content.");
    b.revision = revision; b.baseContent = b.server.content; b.content = content; b.conflict = false; b.error = undefined;
    b.sequence++; b.dirty = content !== b.server.content; this.notify();
    await this.save(id);
  }
  edit(id: string, content: string): void {
    const b = this.buffers.get(id);
    if (!b?.loaded || b.deleting) throw new Error("This file is loading or being deleted.");
    b.content = content; b.dirty = true; b.sequence++;
    if (b.timer) clearTimeout(b.timer);
    if (!b.conflict) b.timer = setTimeout(() => { b.timer = undefined; void this.save(id).catch(() => {}); }, this.debounceMs);
    this.notify();
  }
  async save(id: string): Promise<void> {
    const b = this.buffers.get(id);
    if (!b) return;
    if (b.timer) clearTimeout(b.timer); b.timer = undefined;
    if (b.flight) return b.flight;
    if (b.conflict) throw new Error("Resolve the file conflict before retrying.");
    if (!b.dirty && !b.server.recoveryPending) return;
    const flight = (async () => {
      if (b.server.recoveryPending) {
        await this.refresh(id);
        if (b.server.recoveryPending) throw new Error("Committed content is awaiting server recovery.");
        if (b.conflict) throw new Error("Resolve the file conflict before retrying.");
        if (b.content === b.server.content) { b.dirty = false; b.error = undefined; return; }
      }
      while (b.dirty) {
        if (b.conflict) throw new Error("Resolve the file conflict before retrying.");
        const sequence = b.sequence, content = b.content, revision = b.revision;
        b.error = undefined;
        try {
          let server: ServerFile;
          try {
            const result = await this.persist(id, content, revision);
            if (!Number.isSafeInteger(result.contentRevision) || result.contentRevision !== revision + 1) throw new Error("Save response did not confirm the expected file revision.");
            server = { ...result, content: result.content ?? content };
          } catch (error) {
            // A lost acknowledgment may follow a committed write. Read, never guess.
            if (!this.read) throw error;
            server = await this.read(id);
            if (server.contentRevision <= revision || server.content !== content) {
              this.merge({ id, ...server, contentLoaded: true }, b.projectId);
              if ((error as { status?: number }).status === 409 || server.contentRevision > revision) b.conflict = true;
              throw error;
            }
          }
          if (server.contentRevision < b.server.contentRevision) {
            b.conflict = true; throw new Error("A newer server write arrived during saving. Resolve the conflict.");
          }
          b.server = server; b.revision = server.contentRevision; b.baseContent = server.content;
          if (server.recoveryPending) throw new Error("Content committed; server metadata recovery is pending. Retry to reconcile.");
          if (!b.conflict && sequence === b.sequence) b.dirty = false;
        } catch (error) {
          b.error = error instanceof Error ? error : new Error("Save failed"); throw b.error;
        }
      }
    })();
    b.flight = flight; this.notify();
    try { await flight; }
    catch (error) { b.error = error instanceof Error ? error : new Error("Save failed"); throw b.error; }
    finally { b.flight = undefined; this.notify(); }
  }
  async delete(id: string, choice: "save" | "discard" | undefined, remove: (revision: number) => Promise<void>): Promise<void> {
    const projectId = this.buffers.get(id)?.projectId ?? this.recovered.get(id)?.projectId ?? "";
    return this.exclusive(projectId, async () => {
    let b = this.buffers.get(id);
    const draft = this.recovered.get(id);
    if ((draft || b?.dirty || b?.flight || b?.conflict) && !choice) throw new Error("Choose Save and delete or Discard and delete for this file.");
    if (b) { b.deleting = true; if (b.timer) clearTimeout(b.timer); b.timer = undefined; this.notify(); }
    try {
      if (draft && choice === "save") {
        if (!this.read) throw new Error("Load and review the recovered draft before deleting.");
        const server = await this.read(id);
        this.merge({ id, ...server, contentLoaded: true }, projectId);
        b = this.buffers.get(id)!; b.deleting = true; this.notify();
        if (server.contentRevision !== draft.revision || server.content !== draft.baseContent || server.recoveryPending) {
          throw new Error("Resolve the recovered draft against the current server before deleting.");
        }
        // Save-and-delete explicitly chooses the draft only when its original base still matches.
        await this.resolve(id, server.contentRevision, draft.content);
      }
      if (b?.flight) await b.flight.catch(() => {});
      if (choice === "save") await this.save(id);
      await remove(b?.server.contentRevision ?? 0);
      this.buffers.delete(id); this.recovered.delete(id);
    } catch (error) {
      if (this.read && !this.recovered.has(id)) await this.refresh(id).catch(() => {});
      throw error;
    } finally { if (b) b.deleting = false; this.notify(); }
    });
  }
  async flush(projectId: string): Promise<void> {
    await this.operations.get(projectId);
    await this.flushBuffers(projectId);
  }
  private async flushBuffers(projectId: string): Promise<void> {
    if ([...this.recovered.values()].some(d => d.projectId === projectId)) throw new Error("Recovered drafts must be opened and reviewed before compilation.");
    do {
      const pending = [...this.buffers].filter(([, b]) => b.projectId === projectId && (b.dirty || b.flight || b.conflict || b.server.recoveryPending));
      const results = await Promise.allSettled(pending.map(([id]) => this.save(id)));
      const failed = results.findIndex(r => r.status === "rejected");
      if (failed !== -1) throw new Error("Could not save file " + pending[failed][0] + ": " + (results[failed] as PromiseRejectedResult).reason.message + ". Local edits are retained.");
    } while ([...this.buffers.values()].some(b => b.projectId === projectId && b.dirty));
  }
  error(projectId: string): string | null { return [...this.buffers.values()].find(b => b.projectId === projectId && b.error)?.error?.message
    ?? ([...this.buffers.values()].some(b => b.projectId === projectId && b.server.recoveryPending) ? "Committed content is awaiting server metadata recovery. Use Save to reconcile." : null); }
  status(projectId: string): FileSaveStatus {
    const buffers = [...this.buffers.values()].filter(b => b.projectId === projectId);
    if (buffers.some(b => b.error || b.conflict || b.server.recoveryPending)) return "error";
    if (this.operations.has(projectId) || buffers.some(b => b.flight)) return "saving";
    return buffers.some(b => b.dirty) || [...this.recovered.values()].some(d => d.projectId === projectId) ? "unsaved" : "saved";
  }
}
export async function afterSaved<T>(manager: FileSaveManager, projectId: string, operation: () => Promise<T>): Promise<T> {
  await manager.flush(projectId); return operation();
}

