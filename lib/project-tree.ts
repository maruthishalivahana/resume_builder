import type { LatexFileItem, LatexFolderItem } from "@/types/latex";

export type ProjectTreeNode =
  | { kind: "file"; item: LatexFileItem }
  | { kind: "folder"; item: LatexFolderItem; children: ProjectTreeNode[] };
export type ProjectTree = { roots: ProjectTreeNode[]; inaccessible: ProjectTreeNode[]; diagnostics: string[] };

/** Parent IDs alone determine ancestry. Invalid edges are broken only in the display model. */
export function buildProjectTree(files: LatexFileItem[], folders: LatexFolderItem[]): ProjectTree {
  const nodes = new Map<string, Extract<ProjectTreeNode, { kind: "folder" }>>();
  const parents = new Map<string, string | null>();
  const inaccessible = new Set<string>();
  const diagnostics: string[] = [];
  for (const folder of folders) {
    nodes.set(folder.id, { kind: "folder", item: folder, children: [] });
    parents.set(folder.id, folder.parentFolderId ?? null);
  }
  for (const folder of folders) {
    const parent = parents.get(folder.id)!;
    if (parent !== null && !nodes.has(parent)) {
      diagnostics.push(`Folder ${folder.path || folder.name} (${folder.id}) has missing parent ${parent}.`);
      inaccessible.add(folder.id); parents.set(folder.id, null);
    }
  }
  // Iterative parent walks handle disconnected cycles and very deep projects without stack recursion.
  const done = new Set<string>();
  for (const folder of folders) {
    const chain: string[] = [], positions = new Map<string, number>();
    let id: string | null = folder.id;
    while (id !== null && !done.has(id)) {
      const position = positions.get(id);
      if (position !== undefined) {
        const cycle = chain.slice(position);
        diagnostics.push(`Folder parent cycle: ${cycle.map(key => `${nodes.get(key)!.item.name} (${key})`).join(" → ")}. Displaying ${nodes.get(id)!.item.name} under inaccessible records.`);
        inaccessible.add(id); parents.set(id, null);
        break;
      }
      positions.set(id, chain.length); chain.push(id);
      id = parents.get(id) ?? null;
    }
    chain.forEach(key => done.add(key));
  }
  const tree: ProjectTree = { roots: [], inaccessible: [], diagnostics };
  for (const folder of folders) {
    const node = nodes.get(folder.id)!;
    const parent = parents.get(folder.id)!;
    if (inaccessible.has(folder.id)) tree.inaccessible.push(node);
    else if (parent !== null) nodes.get(parent)!.children.push(node);
    else tree.roots.push(node);
  }
  // Retain input objects, content, revisions, and loaded state; rendering never merges server snapshots.
  for (const file of files) {
    const node: ProjectTreeNode = { kind: "file", item: file };
    const parent = file.folderId ?? null;
    if (parent === null) tree.roots.push(node);
    else if (nodes.has(parent)) nodes.get(parent)!.children.push(node);
    else {
      diagnostics.push(`File ${file.path || file.name} (${file.id}) has missing parent ${parent}.`);
      tree.inaccessible.push(node);
    }
  }
  return tree;
}

/** Depth-first traversal with an explicit stack: a collapsed parent hides its entire subtree. */
export function visibleProjectTree(roots: ProjectTreeNode[], expandedFolderIds: string[]): Array<{ node: ProjectTreeNode; depth: number }> {
  const expanded = new Set(expandedFolderIds);
  const stack = roots.map(node => ({ node, depth: 0 })).reverse();
  const rows: Array<{ node: ProjectTreeNode; depth: number }> = [];
  while (stack.length) {
    const row = stack.pop()!;
    rows.push(row);
    if (row.node.kind === "folder" && expanded.has(row.node.item.id)) {
      for (let index = row.node.children.length - 1; index >= 0; index--) {
        stack.push({ node: row.node.children[index], depth: row.depth + 1 });
      }
    }
  }
  return rows;
}
