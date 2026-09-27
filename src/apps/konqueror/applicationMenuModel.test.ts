import { describe, expect, it } from "vitest";
import {
  getKonquerorApplicationMenuEntries,
  toggleKonquerorApplicationMenu,
  type KonquerorApplicationMenuAvailability,
  type KonquerorApplicationMenuEntry,
  type KonquerorApplicationMenuSubmenuEntry,
} from "./applicationMenuModel";
import type { KonquerorBookmarkNode } from "./bookmarks";

const available: KonquerorApplicationMenuAvailability = {
  canPrint: true,
  printTitle: "Print",
  canCreateNewFolder: true,
  createNewFolderTitle: "Create New Folder",
  canCreateNewTextFile: true,
  createNewTextFileTitle: "Create New Text File",
  canOpen: true,
  openTitle: "Open",
  canEdit: true,
  editTitle: "Edit",
  canShowProperties: true,
  propertiesTitle: "Properties",
  canRename: true,
  renameTitle: "Rename",
  canCut: true,
  cutTitle: "Cut",
  canCopy: true,
  copyTitle: "Copy",
  canPaste: true,
  pasteTitle: "Paste",
  canCopyFiles: true,
  copyFilesTitle: "Copy Files",
  canMoveFiles: true,
  moveFilesTitle: "Move Files",
  canMoveToTrash: true,
  moveToTrashTitle: "Move to Trash",
  canRestore: false,
  restoreTitle: "Restore from the Trash first",
  canDeletePermanently: false,
  deletePermanentlyTitle: "Open the Trash root first",
  canEmptyTrash: false,
  emptyTrashTitle: "Open the Trash root first",
  canGoBack: false,
  backTitle: "No previous location",
  canGoForward: true,
  forwardTitle: "Forward",
  canGoUp: true,
  upTitle: "Up",
  canGoHome: true,
  homeTitle: "Home",
  viewControlsDisabled: false,
  canOpenTerminal: true,
  openTerminalTitle: "Open Terminal",
  canDetachCurrentTab: true,
  canCloseCurrentTab: true,
  canBookmarkTabsAsFolder: true,
  bookmarkTabsAsFolderTitle: "Bookmark Tabs as Folder",
  isMainToolbarVisible: true,
  isLocationToolbarVisible: true,
};

const entriesFor = (menu: Parameters<typeof getKonquerorApplicationMenuEntries>[0], rootChildren: readonly KonquerorBookmarkNode[] = []) =>
  getKonquerorApplicationMenuEntries(menu, available, "tree", { key: "name", direction: "ascending" }, rootChildren);

const folder = (id: string, name: string, children: readonly KonquerorBookmarkNode[] = []): KonquerorBookmarkNode => ({
  id,
  type: "folder",
  name,
  children,
});

const bookmark = (id: string, name: string): KonquerorBookmarkNode => ({
  id,
  type: "bookmark",
  name,
  location: `/${name}`,
  comment: "",
  firstViewed: null,
  lastViewed: null,
  visitCount: 0,
});

const submenuFor = (entries: readonly KonquerorApplicationMenuEntry[], id: KonquerorApplicationMenuSubmenuEntry["id"]) => {
  const entry = entries.find((candidate): candidate is KonquerorApplicationMenuSubmenuEntry =>
    candidate.kind === "submenu" && candidate.id === id,
  );

  if (!entry) {
    throw new Error(`Missing ${id} submenu`);
  }

  return entry;
};

describe("Konqueror application menu model", () => {
  it("keeps exactly one application dropdown open and toggles its current button", () => {
    expect(toggleKonquerorApplicationMenu(null, "location")).toBe("location");
    expect(toggleKonquerorApplicationMenu("location", "edit")).toBe("edit");
    expect(toggleKonquerorApplicationMenu("edit", "view")).toBe("view");
    expect(toggleKonquerorApplicationMenu("location", "location")).toBeNull();
  });

  it("defines Location as New Window, New Tab, Print, and Quit with its two separators", () => {
    expect(entriesFor("location")).toEqual([
      expect.objectContaining({ kind: "action", action: "new-window", label: "New Window" }),
      expect.objectContaining({ kind: "action", action: "new-tab", label: "New Tab" }),
      { kind: "separator" },
      expect.objectContaining({ kind: "action", action: "print", label: "Print", enabled: true }),
      { kind: "separator" },
      expect.objectContaining({ kind: "action", action: "close", label: "Quit" }),
    ]);
  });

  it("defines the contiguous Edit surface with selection-aware direct file operations", () => {
    const entries = entriesFor("edit");

    expect(entries.map((entry) => entry.kind === "separator" ? "separator" : entry.label)).toEqual([
      "Undo",
      "Cut",
      "Copy",
      "Paste",
      "Rename",
      "Move to Trash",
      "Delete",
      "Copy Files",
      "Move Files",
      "Create New",
      "Properties",
    ]);
    expect(entries.filter((entry) => entry.kind === "separator")).toHaveLength(0);
    expect(entries).toContainEqual(expect.objectContaining({ action: "undo", enabled: false }));
    expect(entries).toContainEqual(expect.objectContaining({ action: "copy-files", enabled: true }));
    expect(entries).toContainEqual(expect.objectContaining({ action: "move-files", enabled: true }));

    expect(submenuFor(entries, "create-new").items).toEqual([
      expect.objectContaining({ action: "new-folder", label: "Folder", enabled: true }),
      { kind: "separator" },
      expect.objectContaining({ action: "new-text-file", label: "Text File", enabled: true }),
    ]);
  });

  it("enables Undo only when shared file-operation history exposes a reversible entry", () => {
    const entries = getKonquerorApplicationMenuEntries(
      "edit",
      { ...available, canUndo: true, undoTitle: "Undo the last file operation" },
      "tree",
      { key: "name", direction: "ascending" },
    );

    expect(entries).toContainEqual(expect.objectContaining({ action: "undo", enabled: true, title: "Undo the last file operation" }));
  });

  it("uses the existing selection and current-directory availability for Edit actions", () => {
    const unavailable = {
      ...available,
      canRename: false,
      canCut: false,
      canCopy: false,
      canPaste: false,
      canCopyFiles: false,
      canMoveFiles: false,
      canMoveToTrash: false,
      canDeletePermanently: false,
      canShowProperties: false,
      canCreateNewFolder: false,
      canCreateNewTextFile: false,
    };
    const entries = getKonquerorApplicationMenuEntries("edit", unavailable, "tree", { key: "name", direction: "ascending" });

    for (const actionName of ["rename", "cut", "copy", "paste", "copy-files", "move-files", "move-to-trash", "permanent-delete", "properties"] as const) {
      expect(entries).toContainEqual(expect.objectContaining({ kind: "action", action: actionName, enabled: false }));
    }
    expect(submenuFor(entries, "create-new").enabled).toBe(false);
  });

  it("uses submenus for the shared view mode and sort authorities", () => {
    const entries = getKonquerorApplicationMenuEntries(
      "view",
      available,
      "icons",
      { key: "modified", direction: "descending" },
    );
    const viewMode = submenuFor(entries, "view-mode");
    const sort = submenuFor(entries, "sort");

    expect(entries.map((entry) => entry.kind === "separator" ? "separator" : entry.label)).toEqual([
      "View Mode",
      "separator",
      "Sort",
    ]);
    expect(viewMode.items).toEqual([
      expect.objectContaining({ action: "view-tree", checkKind: "radio", checked: false }),
      expect.objectContaining({ action: "view-icons", checkKind: "radio", checked: true }),
    ]);
    expect(sort.items).toEqual([
      expect.objectContaining({ action: "sort-name", label: "By Name", checkKind: "radio", checked: false }),
      expect.objectContaining({ action: "sort-size", label: "By Size", checkKind: "radio", checked: false }),
      expect.objectContaining({ action: "sort-type", label: "By Type", checkKind: "radio", checked: false }),
      expect.objectContaining({ action: "sort-modified", label: "By Date", checkKind: "radio", checked: true }),
      { kind: "separator" },
      expect.objectContaining({ action: "toggle-sort-direction", label: "Descending", checkKind: "checkbox", checked: true }),
    ]);
  });

  it("keeps the empty Bookmarks root to its implemented root commands while Go, Tools, Window, and Help retain their surfaces", () => {
    expect(entriesFor("go")).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "back" }),
      expect.objectContaining({ action: "forward" }),
      expect.objectContaining({ action: "up" }),
      expect.objectContaining({ action: "home" }),
    ]));
    expect(entriesFor("help")).toEqual([
      expect.objectContaining({ action: "about-konqueror", label: "About Konqueror" }),
      expect.objectContaining({ action: "about-kde", label: "About KDE" }),
    ]);
    expect(entriesFor("bookmarks")).toEqual([
      expect.objectContaining({ action: "add-bookmark", label: "Add Bookmark", enabled: false, shortcut: "Ctrl+B" }),
      expect.objectContaining({ action: "bookmark-tabs-as-folder", label: "Bookmark Tabs as Folder...", enabled: true }),
      expect.objectContaining({ action: "edit-bookmarks", label: "Edit Bookmarks", enabled: true, shortcut: undefined }),
      expect.objectContaining({ action: "new-bookmark-folder", label: "New Bookmark Folder...", enabled: true }),
    ]);
    expect(entriesFor("tools")).toEqual([
      expect.objectContaining({ action: "open-terminal", label: "Open Terminal", enabled: true }),
      expect.objectContaining({ action: "find-file", label: "Find File...", enabled: true }),
    ]);
    expect(entriesFor("settings")).toEqual([
      expect.objectContaining({ kind: "submenu", id: "toolbars", label: "Toolbars" }),
    ]);
    expect(entriesFor("window")).toEqual([
      expect.objectContaining({ action: "new-tab", label: "New Tab", enabled: true }),
      expect.objectContaining({ action: "duplicate-current-tab", label: "Duplicate Current Tab", enabled: true }),
      expect.objectContaining({ action: "detach-current-tab", label: "Detach Current Tab", enabled: true }),
      expect.objectContaining({ action: "close-current-tab", label: "Close Current Tab", enabled: true }),
    ]);
  });

  it("defines Player in its exact command order without separators", () => {
    const entries = getKonquerorApplicationMenuEntries(
      "player",
      { ...available, canMediaPlay: true, canMediaPause: false, canMediaStop: true, canMediaNext: true, canMediaPrevious: false },
      "tree",
      { key: "name", direction: "ascending" },
    );

    expect(entries.map((entry) => entry.kind === "separator" ? "separator" : entry.label)).toEqual([
      "Play",
      "Pause",
      "Stop",
      "Next",
      "Previous",
    ]);
    const actionEntries = entries.filter((entry): entry is Extract<KonquerorApplicationMenuEntry, { kind: "action" }> => entry.kind === "action");
    expect(actionEntries.map((entry) => entry.action)).toEqual([
      "play",
      "pause",
      "stop",
      "next",
      "previous",
    ]);
    expect(actionEntries.map((entry) => entry.enabled)).toEqual([true, false, true, true, false]);
  });

  it("defines Help as exactly About Konqueror followed by shared About KDE", () => {
    expect(entriesFor("help")).toEqual([
      expect.objectContaining({ kind: "action", action: "about-konqueror", label: "About Konqueror", enabled: true }),
      expect.objectContaining({ kind: "action", action: "about-kde", label: "About KDE", enabled: true }),
    ]);
    expect(entriesFor("help").some((entry) => entry.kind === "separator")).toBe(false);
  });

  it("defines the instance-derived Toolbars checkbox submenu in its exact KDE3 order", () => {
    const entries = getKonquerorApplicationMenuEntries(
      "settings",
      { ...available, isMainToolbarVisible: false, isLocationToolbarVisible: true },
      "tree",
      { key: "name", direction: "ascending" },
    );

    expect(entries).toHaveLength(1);
    expect(submenuFor(entries, "toolbars").items).toEqual([
      expect.objectContaining({
        action: "toggle-main-toolbar",
        label: "Main Toolbar (Konqueror)",
        checked: false,
        checkKind: "checkbox",
        shortcut: undefined,
      }),
      expect.objectContaining({
        action: "toggle-location-toolbar",
        label: "Location Toolbar (Konqueror)",
        checked: true,
        checkKind: "checkbox",
        shortcut: undefined,
      }),
    ]);
  });

  it("preserves the root tree's mixed Bookmark and Folder order with stable leaf IDs", () => {
    const entries = entriesFor("bookmarks", [
      bookmark("bookmark-a", "Bookmark A"),
      folder("folder-b", "Folder B"),
      bookmark("bookmark-c", "Bookmark C"),
      folder("folder-d", "Folder D"),
      bookmark("bookmark-e", "Bookmark E"),
    ]);

    expect(entries.map((entry) => entry.kind === "separator" ? "separator" : entry.label)).toEqual([
      "Add Bookmark",
      "Bookmark Tabs as Folder...",
      "Edit Bookmarks",
      "New Bookmark Folder...",
      "separator",
      "Bookmark A",
      "Folder B",
      "Bookmark C",
      "Folder D",
      "Bookmark E",
    ]);
    expect(entries).toContainEqual(expect.objectContaining({ action: "open-bookmark", bookmarkId: "bookmark-a", shortcut: undefined }));
    expect(entries).toContainEqual(expect.objectContaining({ action: "open-bookmark", bookmarkId: "bookmark-c", shortcut: undefined }));
    expect(entries).toContainEqual(expect.objectContaining({ action: "open-bookmark", bookmarkId: "bookmark-e", shortcut: undefined }));
    expect(entries).toContainEqual(expect.objectContaining({ action: "add-bookmark", icon: "bookmark", shortcut: "Ctrl+B" }));
    expect(entries).toContainEqual(expect.objectContaining({ action: "edit-bookmarks", icon: "edit", shortcut: undefined }));
    expect(submenuFor(entries, "bookmark-folder-folder-b")).toMatchObject({ icon: "folder" });
  });

  it("keeps long dynamic labels as stable typed menu entries with independent icons and shortcuts", () => {
    const longName = "This Is A Very Long Bookmark Name Used To Test KDE Menu Layout Behavior";
    const entries = entriesFor("bookmarks", [bookmark("long-leaf", longName), folder("long-folder", longName)]);
    const savedLeaf = entries.find((entry) => entry.kind === "action" && entry.bookmarkId === "long-leaf");
    expect(savedLeaf).toMatchObject({ label: longName, icon: "bookmark", shortcut: undefined, bookmarkId: "long-leaf" });
    expect(submenuFor(entries, "bookmark-folder-long-folder")).toMatchObject({ label: longName, icon: "folder" });
  });

  it("preserves nested mixed children before the exact folder-targeted commands", () => {
    const entries = entriesFor("bookmarks", [
      folder("folder-b", "Folder B", [
        bookmark("bookmark-x", "Bookmark X"),
        folder("folder-y", "Folder Y"),
        bookmark("bookmark-z", "Bookmark Z"),
      ]),
    ]);

    const folderB = submenuFor(entries, "bookmark-folder-folder-b");
    expect(folderB.items.map((entry) => entry.kind === "separator" ? "separator" : entry.label)).toEqual([
      "Bookmark X",
      "Folder Y",
      "Bookmark Z",
      "separator",
      "Add Bookmark",
      "Bookmark Tabs as Folder...",
      "New Bookmark Folder...",
    ]);
    expect(folderB.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "open-bookmark", bookmarkId: "bookmark-x" }),
      expect.objectContaining({ action: "open-bookmark", bookmarkId: "bookmark-z" }),
      expect.objectContaining({ action: "add-bookmark", parentFolderId: "folder-b" }),
      expect.objectContaining({ action: "bookmark-tabs-as-folder", parentFolderId: "folder-b" }),
      expect.objectContaining({ action: "new-bookmark-folder", parentFolderId: "folder-b" }),
    ]));
  });

  it("adds a separator for Bookmark-only Folder children and none for empty folders", () => {
    const entries = entriesFor("bookmarks", [folder("folder-a", "Folder A", [bookmark("bookmark-a", "Saved A"), bookmark("bookmark-b", "Saved B")])]);
    const menuA = submenuFor(entries, "bookmark-folder-folder-a");

    expect(menuA.items.map((entry) => entry.kind === "separator" ? "separator" : entry.label)).toEqual([
      "Saved A",
      "Saved B",
      "separator",
      "Add Bookmark",
      "Bookmark Tabs as Folder...",
      "New Bookmark Folder...",
    ]);
  });

  it("builds arbitrary-depth folder menus with child folders before the folder-targeted commands", () => {
    const entries = entriesFor("bookmarks", [folder("a", "A", [folder("b", "B", [folder("c", "C")])])]);
    const menuA = submenuFor(entries, "bookmark-folder-a");
    const menuB = submenuFor(menuA.items, "bookmark-folder-b");
    const menuC = submenuFor(menuB.items, "bookmark-folder-c");

    expect(menuA.items.map((entry) => entry.kind === "separator" ? "separator" : entry.label)).toEqual(["B", "separator", "Add Bookmark", "Bookmark Tabs as Folder...", "New Bookmark Folder..."]);
    expect(menuB.items.map((entry) => entry.kind === "separator" ? "separator" : entry.label)).toEqual(["C", "separator", "Add Bookmark", "Bookmark Tabs as Folder...", "New Bookmark Folder..."]);
    expect(menuC.items).toEqual([
      expect.objectContaining({ action: "add-bookmark", parentFolderId: "c" }),
      expect.objectContaining({ action: "bookmark-tabs-as-folder", parentFolderId: "c" }),
      expect.objectContaining({ action: "new-bookmark-folder", parentFolderId: "c" }),
    ]);
  });

  it("keeps Find File available while the active tab does not provide a terminal directory", () => {
    const entries = getKonquerorApplicationMenuEntries(
      "tools",
      { ...available, canOpenTerminal: false, openTerminalTitle: "Open Terminal is available only for an ordinary filesystem directory" },
      "tree",
      { key: "name", direction: "ascending" },
    );

    expect(entries.map((entry) => entry.kind === "action" ? [entry.label, entry.enabled] : entry.kind)).toEqual([
      ["Open Terminal", false],
      ["Find File...", true],
    ]);
  });

  it("disables only the single-tab destructive Window actions without adding separators or unrelated items", () => {
    const entries = getKonquerorApplicationMenuEntries(
      "window",
      { ...available, canDetachCurrentTab: false, canCloseCurrentTab: false },
      "tree",
      { key: "name", direction: "ascending" },
    );

    expect(entries.map((entry) => entry.kind === "action" ? [entry.label, entry.enabled] : entry.kind)).toEqual([
      ["New Tab", true],
      ["Duplicate Current Tab", true],
      ["Detach Current Tab", false],
      ["Close Current Tab", false],
    ]);
  });

  it("does not persist, mutate VFS, or attach global keyboard behavior", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("./applicationMenuModel.ts", import.meta.url), "utf8"),
    );

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("createVfs");
    expect(source).not.toContain("addEventListener");
    expect(source).not.toContain("Ctrl+N");
  });
});
