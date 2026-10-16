import { createHash, randomUUID } from "crypto";
import { hostname } from "os";
import { Model, Types } from "mongoose";
import { AppError } from "../middleware/error.middleware";
import { LatexFile, ILatexFile } from "../models/LatexFile";
import { LatexFolder, ILatexFolder } from "../models/LatexFolder";
import { LatexProject } from "../models/LatexProject";
import { finalizeFileDeletion, finalizeFileWrite } from "./latexWriteRecovery.service";

type NodeType = "file" | "folder";
export type TreeRequest = { kind: "rename" | "create" | "delete"; type: NodeType; id?: string; name?: string;
  parentId?: string | null; content?: string; expectedRevision?: number; selectEntry?: boolean; allowEntryReselection?: boolean };
export type TreeNode = { id: string; type: NodeType; projectId: string; parentId: string | null; name: string; path: string; contentRevision?: number };
type Change = { type: NodeType; id: string; parentId: string | null; before?: { name: string; path: string };
  after?: { name: string; path: string }; content?: string; expectedRevision?: number };
type Owner = { host: string; pid: number; instance: string };
export type TreeOperation = { id: string; key: string; request: TreeRequest; version: number; owner: Owner; changes?: Change[] };
const owner: Owner = { host: hostname(), pid: process.pid, instance: randomUUID() };
const active = new Set<string>();
const pending = () => new AppError("Project tree recovery is pending. Retry the same operation or POST the project tree/recovery endpoint.", 503, "TREE_RECOVERY_PENDING");

export function validateTreeName(name: string): void {
  if (!name || name !== name.trim() || /[/\\<>:"|?*]/.test(name) || [...name].some(char => char.charCodeAt(0) < 32) || name.includes("..") || /[. ]$/.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new AppError("Invalid file or folder name", 400);
}
const pathKey = (path: string) => path.normalize("NFC").toLowerCase();

/** Inventory before any node write. Never repair conflicting legacy records implicitly. */
export function validateTree(nodes: TreeNode[], projectId: string): void {
  const folders = new Map(nodes.filter(n => n.type === "folder").map(n => [n.id, n]));
  const paths = new Map<string, TreeNode>();
  for (const node of nodes) {
    if (node.projectId !== projectId) throw new AppError("Cross-project tree reference", 409, "TREE_INVALID");
    validateTreeName(node.name);
    const parent = node.parentId ? folders.get(node.parentId) : undefined;
    if (node.parentId && !parent) throw new AppError("Parent folder is missing or belongs to another project", 409, "TREE_INVALID");
    if (node.path !== (parent ? `${parent.path}/${node.name}` : node.name)) throw new AppError("Path disagrees with its parent reference", 409, "TREE_INVALID");
    const seen = new Set(node.type === "folder" ? [node.id] : []);
    let ancestor = parent;
    while (ancestor) {
      if (seen.has(ancestor.id)) throw new AppError("Folder parent cycle", 409, "TREE_INVALID");
      seen.add(ancestor.id);
      ancestor = ancestor.parentId ? folders.get(ancestor.parentId) : undefined;
    }
    const key = pathKey(node.path);
    const duplicate = paths.get(key);
    if (duplicate) throw new AppError(`Shared path collision: ${duplicate.path} and ${node.path}`, 409, "TREE_PATH_COLLISION");
    paths.set(key, node);
  }
}

export function planTreeChange(nodes: TreeNode[], projectId: string, request: TreeRequest): Change[] {
  validateTree(nodes, projectId);
  const target = nodes.find(n => n.id === request.id && n.type === request.type);
  if (request.kind !== "create" && !target) throw new AppError("Tree node not found", 404);
  if (request.kind === "delete") {
    if (target!.type === "file" && (target!.contentRevision ?? 0) !== request.expectedRevision) throw new AppError("File changed while deleting. Local edits are retained.", 409, "FILE_REVISION_CONFLICT");
    if (target!.type === "folder" && nodes.some(n => n.parentId === target!.id)) throw new AppError("Folder is not empty", 409);
    return [{ type: target!.type, id: target!.id, parentId: target!.parentId, before: { name: target!.name, path: target!.path }, expectedRevision: request.expectedRevision }];
  }
  const name = request.name ?? "";
  validateTreeName(name);
  if (request.parentId === "") throw new AppError("Invalid parent folder reference", 400, "TREE_INVALID");
  if (request.type === "file" && !name.toLowerCase().endsWith(".tex")) throw new AppError("File must have a .tex extension", 400);
  const parentId = target?.parentId ?? request.parentId ?? null;
  const parent = nodes.find(n => n.type === "folder" && n.id === parentId);
  if (parentId && !parent) throw new AppError("Parent folder is missing or belongs to another project", 409, "TREE_INVALID");
  const path = parent ? `${parent.path}/${name}` : name;
  if (request.kind === "create") {
    const id = new Types.ObjectId().toString();
    validateTree([...nodes, { id, type: request.type, projectId, parentId, name, path }], projectId);
    return [{ type: request.type, id, parentId, after: { name, path }, content: request.content }];
  }
  const prefix = `${target!.path}/`;
  const updated = nodes.map(node => node.id === target!.id && node.type === target!.type ? { ...node, name, path }
    : target!.type === "folder" && node.path.startsWith(prefix) ? { ...node, path: `${path}/${node.path.slice(prefix.length)}` } : node);
  validateTree(updated, projectId);
  return updated.flatMap((node, index) => node.path === nodes[index].path && node.name === nodes[index].name ? [] : [{
    type: node.type, id: node.id, parentId: node.parentId, before: { name: nodes[index].name, path: nodes[index].path }, after: { name: node.name, path: node.path },
  }]);
}

async function inventory(projectId: string): Promise<TreeNode[]> {
  const [files, folders] = await Promise.all([LatexFile.find({ projectId }), LatexFolder.find({ projectId })]);
  return [...files.map(f => ({ id: f._id.toString(), type: "file" as const, projectId: f.projectId.toString(), parentId: f.folderId?.toString() ?? null, name: f.name, path: f.path, contentRevision: f.contentRevision ?? 0 })),
    ...folders.map(f => ({ id: f._id.toString(), type: "folder" as const, projectId: f.projectId.toString(), parentId: f.parentFolderId?.toString() ?? null, name: f.name, path: f.path }))];
}

async function replay(projectId: string, operation: TreeOperation): Promise<void> {
  if (!operation.changes) throw pending();
  for (const change of operation.changes) {
    const parentField = change.type === "file" ? "folderId" : "parentFolderId";
    const model = (change.type === "file" ? LatexFile : LatexFolder) as unknown as Model<ILatexFile | ILatexFolder>;
    if (!change.after) {
      if (change.type === "file") {
        let file = await LatexFile.findById(change.id);
        if (file) {
          if (file.pendingWrite && !await finalizeFileWrite(file)) throw pending();
          if (!file.pendingDelete) {
            file = await LatexFile.findOneAndUpdate({ _id: change.id, projectId, pendingWrite: { $exists: false },
              ...(change.expectedRevision === 0 ? { $or: [{ contentRevision: 0 }, { contentRevision: { $exists: false } }] } : { contentRevision: change.expectedRevision }) },
            { $set: { pendingDelete: true } }, { new: true });
            if (!file) throw new AppError("File changed while deleting. Local edits are retained.", 409, "FILE_REVISION_CONFLICT");
          }
          if (!await finalizeFileDeletion(file)) throw pending();
        }
      } else {
        await LatexFolder.deleteOne({ _id: change.id, projectId, path: change.before!.path });
      }
      continue;
    }
    if (!change.before) {
      const doc = { _id: change.id, projectId, [parentField]: change.parentId, ...change.after, treeVersion: operation.version,
        ...(change.type === "file" ? { content: change.content ?? "", contentRevision: 0, language: "latex" } : {}) };
      // A repeated replay uses the same preallocated ID, never inserts another node.
      await model.updateOne({ _id: change.id, projectId }, { $setOnInsert: doc }, { upsert: true });
    } else {
      const result = await model.updateOne({ _id: change.id, projectId, [parentField]: change.parentId, ...change.before,
        $or: [{ treeVersion: { $lt: operation.version } }, { treeVersion: { $exists: false } }] },
      { $set: { ...change.after, treeVersion: operation.version } });
      if (!result.matchedCount) {
        const current = await model.findById(change.id);
        if (!current || current.path !== change.after.path || current.name !== change.after.name || current.treeVersion !== operation.version) throw pending();
      }
    }
  }
  // Bump and release are one write. Repeated/stale workers cannot invalidate a later journal.
  const first = operation.changes[0];
  if (operation.request.kind === "create" && first?.type === "file" && !first.parentId && operation.request.selectEntry) {
    await LatexProject.updateOne({ _id: projectId, "treeOperation.id": operation.id, entryFileId: null,
      ...(operation.request.allowEntryReselection ? {} : { entryFileSelectionRequired: { $ne: true } }) },
      { $set: { entryFileId: first.id, entryFileSelectionRequired: false } });
  }
  await LatexProject.updateOne({ _id: projectId, "treeOperation.id": operation.id },
    { $inc: { sourceVersion: operation.changes.length ? 1 : 0 }, $unset: { treeOperation: 1 } });
}

/** A durable project gate serializes every namespace mutation across backend instances. */
export async function mutateTree(projectId: string, request: TreeRequest): Promise<string | undefined> {
  if (active.has(projectId)) throw new AppError("A project tree operation is running; retry shortly", 409, "TREE_BUSY");
  active.add(projectId);
  let operation: TreeOperation | undefined;
  try {
    const key = createHash("sha256").update(JSON.stringify(request)).digest("hex");
    let project = await LatexProject.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    operation = project.treeOperation;
    if (operation && operation.key !== key) throw pending();
    if (operation && operation.owner?.instance !== owner.instance) {
      // Never expire a lease underneath a live worker. On this development host,
      // recovery may take ownership only after the former process is confirmed dead.
      if (!operation.owner || operation.owner.host !== owner.host) throw pending();
      let dead = false;
      try { process.kill(operation.owner.pid, 0); } catch (error) { dead = (error as NodeJS.ErrnoException).code === "ESRCH"; }
      if (!dead) throw pending();
      const recovered = { ...operation, owner };
      const claimed = await LatexProject.updateOne({ _id: projectId, "treeOperation.id": operation.id,
        "treeOperation.owner.instance": operation.owner.instance }, { $set: { treeOperation: recovered } });
      if (!claimed.matchedCount) throw pending();
      operation = recovered;
    }
    if (!operation) {
      // Reject an invalid request before changing even project journal metadata.
      // Revalidate under the acquired gate below: another worker may win meanwhile.
      const preflight = planTreeChange(await inventory(projectId), projectId, request);
      if (Buffer.byteLength(JSON.stringify(preflight), "utf8") > 4 * 1024 * 1024) throw new AppError("Rename manifest exceeds the recovery journal limit", 413);
      const id = randomUUID();
      const version = (project.treeVersion ?? 0) + 1;
      project = await LatexProject.findOneAndUpdate({ _id: projectId, treeOperation: { $exists: false },
        ...((project.treeVersion ?? 0) === 0 ? { $or: [{ treeVersion: 0 }, { treeVersion: { $exists: false } }] } : { treeVersion: project.treeVersion }) },
        { $inc: { treeVersion: 1 }, $set: { treeOperation: { id, key, request, version, owner } } }, { new: true });
      if (!project) throw pending();
      operation = { id, key, request, version: project.treeVersion ?? 1, owner };
    }
    if (!operation.changes) {
      let changes: Change[];
      try {
        changes = planTreeChange(await inventory(projectId), projectId, request);
        if (Buffer.byteLength(JSON.stringify(changes), "utf8") > 4 * 1024 * 1024) throw new AppError("Rename manifest exceeds the recovery journal limit", 413);
      } catch (error) {
        // No node has been changed: release only this unprepared intent.
        await LatexProject.updateOne({ _id: projectId, "treeOperation.id": operation.id, "treeOperation.changes": { $exists: false } }, { $unset: { treeOperation: 1 } });
        throw error;
      }
      operation = { ...operation, changes };
      await LatexProject.updateOne({ _id: projectId, "treeOperation.id": operation.id, "treeOperation.changes": { $exists: false } }, { $set: { treeOperation: operation } });
      const authoritative = await LatexProject.findById(projectId);
      if (authoritative?.treeOperation?.id !== operation.id || !authoritative.treeOperation.changes) throw pending();
      operation = authoritative.treeOperation;
    }
    try { await replay(projectId, operation); } catch (error) {
      if (error instanceof AppError && error.code === "FILE_REVISION_CONFLICT") {
        // A one-file delete CAS failed before deleting anything. Do not trap a newer edit in a stale journal.
        await LatexProject.updateOne({ _id: projectId, "treeOperation.id": operation.id }, { $unset: { treeOperation: 1 } });
        throw error;
      }
      throw new AppError(`Tree operation needs recovery: ${error instanceof Error ? error.message : "write failed"}. Retry the same request.`, 503, "TREE_RECOVERY_PENDING");
    }
    return request.id ?? operation.changes?.[0]?.id;
  } finally { active.delete(projectId); }
}

export async function recoverTree(projectId: string): Promise<void> {
  const project = await LatexProject.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);
  if (project.treeOperation) await mutateTree(projectId, project.treeOperation.request);
}

export async function recoverDeletedTreeNode(id: string, type: NodeType): Promise<void> {
  const project = await LatexProject.findOne({ "treeOperation.request.kind": "delete", "treeOperation.request.id": id, "treeOperation.request.type": type });
  if (project) await recoverTree(project._id.toString());
}

export async function assertTreeReady(projectId: string): Promise<number> {
  const project = await LatexProject.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);
  if (project?.treeOperation) throw pending();
  return project.treeVersion ?? 0;
}
