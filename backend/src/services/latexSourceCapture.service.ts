import { createHash } from "crypto";
import { LatexProject, ILatexProject } from "../models/LatexProject";
import { LatexFile, ILatexFile } from "../models/LatexFile";
import { LatexFolder, ILatexFolder } from "../models/LatexFolder";
import type { SourceCapture } from "../models/LatexCompilation";
import { AppError } from "../middleware/error.middleware";
import { resolveEntryFile } from "./latexEntryFile.service";
import { validateTree } from "./latexTree.service";

const sha = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");
interface CaptureRead<T> extends PromiseLike<T> {
  read?: (preference: string) => CaptureRead<T>;
  readConcern?: (level: string) => CaptureRead<T>;
}
function committed<T>(query: PromiseLike<T>): PromiseLike<T> {
  // Real Mongoose queries support these methods; isolated model stubs return promises.
  const read = query as CaptureRead<T>;
  const primary = read.read ? read.read("primary") : read;
  return primary.readConcern ? primary.readConcern("majority") : primary;
}
function copy<T extends { toObject?: () => T }>(document: T): T {
  return Object.freeze({ ...(document.toObject ? document.toObject() : document) });
}
function ready(project: ILatexProject | null): asserts project is ILatexProject {
  if (!project) throw new AppError("Project not found", 404);
  if (project.treeOperation) throw new AppError("Project tree recovery is pending; retry the rename before compiling", 409, "TREE_RECOVERY_PENDING");
}

async function collect(projectId: string, requestedEntryId?: string) {
  const before = await committed(LatexProject.findById(projectId)); ready(before);
  const project = copy<ILatexProject>(before);
  // Copy immediately: workspace assembly must never retain mutable model objects.
  const files = (await committed(LatexFile.find({ projectId }))).map(file => copy<ILatexFile>(file));
  if (files.some(file => file.pendingWrite || file.pendingDelete)) throw new AppError("A committed file write is awaiting metadata recovery. Reload the affected file before compiling.", 409, "WRITE_RECOVERY_PENDING");
  const folders = (await committed(LatexFolder.find({ projectId }))).map(folder => copy<ILatexFolder>(folder));
  const after = await committed(LatexProject.findById(projectId)); ready(after);
  if ((after.treeVersion ?? 0) !== (project.treeVersion ?? 0)) throw new AppError("Project tree changed while preparing compilation; retry", 409, "TREE_CHANGED");
  if (requestedEntryId === undefined && after.entryFileId?.toString() !== project.entryFileId?.toString()) throw new AppError("Project entry changed while preparing compilation; reload and retry", 409, "ENTRY_FILE_CHANGED");
  const entry = await resolveEntryFile(project, files, requestedEntryId);
  validateTree([
    ...files.map(file => ({ id: file._id.toString(), type: "file" as const, projectId: file.projectId.toString(), parentId: file.folderId?.toString() ?? null, name: file.name, path: file.path })),
    ...folders.map(folder => ({ id: folder._id.toString(), type: "folder" as const, projectId: folder.projectId.toString(), parentId: folder.parentFolderId?.toString() ?? null, name: folder.name, path: folder.path })),
  ], projectId);
  const fileManifest = files.map(file => {
    const content = file.content ?? "", revision = file.contentRevision ?? 0;
    if (typeof content !== "string" || !Number.isSafeInteger(revision) || revision < 0) throw new AppError("Invalid persisted source content or revision", 409, "SOURCE_INVALID");
    return { fileId: file._id.toString(), path: file.path, folderId: file.folderId?.toString() ?? null,
      contentRevision: revision, sha256: sha(content), byteLength: Buffer.byteLength(content, "utf8") };
  }).sort((a, b) => a.fileId.localeCompare(b.fileId));
  const folderManifest = folders.map(folder => ({ folderId: folder._id.toString(), path: folder.path, parentFolderId: folder.parentFolderId?.toString() ?? null }))
    .sort((a, b) => a.folderId.localeCompare(b.folderId));
  const manifest = { version: 1 as const, entryFileId: entry._id.toString(), sourceVersion: project.sourceVersion ?? 0,
    treeVersion: project.treeVersion ?? 0, files: fileManifest, folders: folderManifest };
  return { project, files, folders, entry, manifest, stableVersion: (after.sourceVersion ?? 0) === manifest.sourceVersion,
    fingerprint: sha(JSON.stringify({ projectId, ...manifest })) };
}

/** Identical complete collections identify one stable saved state under monotonic
 * content/tree revisions. Writes after capture are allowed; they cannot mutate these bytes.
 * No transaction/lock is held across pdfLaTeX. Recovery markers must never be bypassed.
 */
export async function captureProjectSource(projectId: string, requestedEntryId?: string) {
  projectId = projectId.toLowerCase();
  for (let attempt = 0; attempt < 3; attempt++) {
    const first = await collect(projectId, requestedEntryId);
    const second = await collect(projectId, requestedEntryId);
    if (requestedEntryId === undefined && first.entry._id.toString() !== second.entry._id.toString()) throw new AppError("Project entry changed while preparing compilation; reload and retry", 409, "ENTRY_FILE_CHANGED");
    if (!first.stableVersion || !second.stableVersion || first.fingerprint !== second.fingerprint) continue;
    const sourceCapture: SourceCapture = { ...second.manifest, hash: second.fingerprint, capturedAt: new Date() };
    return { project: second.project, files: second.files, folders: second.folders, entry: second.entry, sourceCapture };
  }
  throw new AppError("Project source kept changing during capture. Save pending edits and retry compilation.", 409, "SOURCE_CAPTURE_CHANGED");
}
