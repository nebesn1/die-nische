import type { KonquerorBookmarkNode, KonquerorBookmarkTree } from "./bookmarks";

export type BookmarkEditorSelectionId = string | null;

export type BookmarkEditorTreeRow = Readonly<{
  id: string | null;
  node: KonquerorBookmarkNode | null;
  depth: number;
  isExpanded: boolean;
}>;

const matchesSearch = (node: KonquerorBookmarkNode, query: string): boolean => {
  const haystack = node.type === "bookmark"
    ? [node.name, node.location, node.comment]
    : [node.name];
  return haystack.some((value) => value.toLocaleLowerCase().includes(query));
};

const allRows = (nodes: readonly KonquerorBookmarkNode[], depth: number): readonly BookmarkEditorTreeRow[] => nodes.flatMap((node) => [
  { id: node.id, node, depth, isExpanded: node.type === "folder" },
  ...(node.type === "folder" ? allRows(node.children, depth + 1) : []),
]);

const filteredRows = (nodes: readonly KonquerorBookmarkNode[], depth: number, query: string): readonly BookmarkEditorTreeRow[] => nodes.flatMap((node) => {
  if (matchesSearch(node, query)) {
    return [{ id: node.id, node, depth, isExpanded: node.type === "folder" }, ...(node.type === "folder" ? allRows(node.children, depth + 1) : [])];
  }

  if (node.type !== "folder") return [];
  const descendants = filteredRows(node.children, depth + 1, query);
  return descendants.length === 0 ? [] : [{ id: node.id, node, depth, isExpanded: true }, ...descendants];
});

const expandedRows = (
  nodes: readonly KonquerorBookmarkNode[],
  depth: number,
  expandedFolderIds: ReadonlySet<string>,
): readonly BookmarkEditorTreeRow[] => nodes.flatMap((node) => [
  { id: node.id, node, depth, isExpanded: node.type === "folder" && expandedFolderIds.has(node.id) },
  ...(node.type === "folder" && expandedFolderIds.has(node.id) ? expandedRows(node.children, depth + 1, expandedFolderIds) : []),
]);

/** Pure editor projection: search preserves ancestors, while normal mode follows local expansion state. */
export function getBookmarkEditorTreeRows(
  tree: KonquerorBookmarkTree,
  expandedFolderIds: ReadonlySet<string>,
  searchDraft: string,
): readonly BookmarkEditorTreeRow[] {
  const query = searchDraft.trim().toLocaleLowerCase();
  const children = query.length > 0
    ? filteredRows(tree.rootChildren, 1, query)
    : expandedRows(tree.rootChildren, 1, expandedFolderIds);
  return [{ id: null, node: null, depth: 0, isExpanded: true }, ...children];
}

export function getBookmarkEditorSiblingPosition(
  tree: KonquerorBookmarkTree,
  selectedId: BookmarkEditorSelectionId,
): Readonly<{ parentId: string | null; index: number; siblingCount: number }> | null {
  const find = (nodes: readonly KonquerorBookmarkNode[], parentId: string | null): Readonly<{ parentId: string | null; index: number; siblingCount: number }> | null => {
    const index = nodes.findIndex((node) => node.id === selectedId);
    if (index >= 0) return { parentId, index, siblingCount: nodes.length };
    for (const node of nodes) {
      if (node.type === "folder") {
        const found = find(node.children, node.id);
        if (found !== null) return found;
      }
    }
    return null;
  };
  return selectedId === null ? null : find(tree.rootChildren, null);
}
