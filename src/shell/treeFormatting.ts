import type { ShellVfsWalkEntry } from "./vfsTraversal";

export function formatShellVfsTree(entries: readonly ShellVfsWalkEntry[]): string {
  const root = entries[0];

  if (!root) {
    return "";
  }

  const childrenByParentId = new Map<string, ShellVfsWalkEntry[]>();

  for (const entry of entries.slice(1)) {
    const parentId = entry.node.parentId;

    if (parentId === null) {
      continue;
    }

    const siblings = childrenByParentId.get(parentId) ?? [];
    childrenByParentId.set(parentId, [...siblings, entry]);
  }

  const lines = [root.path];

  const appendChildren = (parentId: string, prefix: string): void => {
    const children = childrenByParentId.get(parentId) ?? [];

    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      lines.push(`${prefix}${isLast ? "`--" : "|--"} ${child.node.name}`);
      appendChildren(child.node.id, `${prefix}${isLast ? "    " : "|   "}`);
    });
  };

  appendChildren(root.node.id, "");

  return `${lines.join("\n")}\n`;
}
