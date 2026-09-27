import type { KonquerorBookmarkNode, KonquerorBookmarkNodeId } from "../konqueror/bookmarks";

export type KonsoleBookmarksMenuAction =
  | Readonly<{ type: "add-bookmark"; parentId: string | null }>
  | Readonly<{ type: "edit-bookmarks" }>
  | Readonly<{ type: "new-folder"; parentId: string | null }>
  | Readonly<{ type: "open-bookmark"; bookmarkId: KonquerorBookmarkNodeId }>;

export type KonsoleBookmarksMenuEntry =
  | Readonly<{ type: "separator"; id: string }>
  | Readonly<{ type: "action"; id: string; label: string; action: KonsoleBookmarksMenuAction; nodeType?: "bookmark" }>
  | Readonly<{ type: "submenu"; id: string; label: string; children: readonly KonsoleBookmarksMenuEntry[] }>;

const addBookmark = (parentId: string | null): KonsoleBookmarksMenuEntry => ({
  type: "action",
  id: `add-bookmark:${parentId ?? "root"}`,
  label: "Add Bookmark",
  action: { type: "add-bookmark", parentId },
});
const newFolder = (parentId: string | null): KonsoleBookmarksMenuEntry => ({
  type: "action",
  id: `new-folder:${parentId ?? "root"}`,
  label: "New Bookmark Folder...",
  action: { type: "new-folder", parentId },
});

function getSavedEntry(node: KonquerorBookmarkNode): KonsoleBookmarksMenuEntry {
  if (node.type === "bookmark") {
    return {
      type: "action",
      id: `bookmark:${node.id}`,
      label: node.name,
      nodeType: "bookmark",
      action: { type: "open-bookmark", bookmarkId: node.id },
    };
  }
  return {
    type: "submenu",
    id: `folder:${node.id}`,
    label: node.name,
    children: getKonsoleBookmarkFolderMenuEntries(node.id, node.children),
  };
}

export function getKonsoleBookmarkFolderMenuEntries(folderId: string, children: readonly KonquerorBookmarkNode[]): readonly KonsoleBookmarksMenuEntry[] {
  return [
    ...children.map(getSavedEntry),
    ...(children.length > 0 ? [{ type: "separator" as const, id: `saved-separator:${folderId}` }] : []),
    addBookmark(folderId),
    newFolder(folderId),
  ];
}

export function getKonsoleBookmarksMenuEntries(rootChildren: readonly KonquerorBookmarkNode[]): readonly KonsoleBookmarksMenuEntry[] {
  return [
    addBookmark(null),
    { type: "action", id: "edit-bookmarks", label: "Edit Bookmarks", action: { type: "edit-bookmarks" } },
    newFolder(null),
    ...(rootChildren.length > 0 ? [{ type: "separator" as const, id: "saved-separator:root" }] : []),
    ...rootChildren.map(getSavedEntry),
  ];
}
