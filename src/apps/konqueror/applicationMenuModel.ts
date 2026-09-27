import type { KonquerorResourceViewMode, KonquerorSortDirection, KonquerorSortKey } from "./directoryViewModel";
import {
  isKonquerorBookmarkFolder,
  type KonquerorBookmarkFolderId,
  type KonquerorBookmarkNode,
  type KonquerorBookmarkNodeId,
} from "./bookmarks";
import type { KonquerorMediaCommand } from "./mediaCommandModel";

export type KonquerorApplicationMenu =
  | "location"
  | "edit"
  | "view"
  | "go"
  | "bookmarks"
  | "player"
  | "tools"
  | "settings"
  | "window"
  | "help";

/** Each dropdown opening gets its own positioning request. */
export type KonquerorApplicationMenuRequest = {
  readonly menu: KonquerorApplicationMenu;
  readonly requestId: number;
};

/** Keeps the menubar to one transient dropdown without touching application state. */
export function toggleKonquerorApplicationMenu(
  openMenu: KonquerorApplicationMenu | null,
  requestedMenu: KonquerorApplicationMenu,
): KonquerorApplicationMenu | null {
  return openMenu === requestedMenu ? null : requestedMenu;
}

export type KonquerorApplicationMenuAction =
  | KonquerorMediaCommand
  | "add-bookmark"
  | "bookmark-tabs-as-folder"
  | "edit-bookmarks"
  | "new-bookmark-folder"
  | "open-bookmark"
  | "new-window"
  | "new-tab"
  | "open-terminal"
  | "find-file"
  | "duplicate-current-tab"
  | "detach-current-tab"
  | "close-current-tab"
  | "print"
  | "new-folder"
  | "new-text-file"
  | "properties"
  | "close"
  | "undo"
  | "rename"
  | "cut"
  | "copy"
  | "paste"
  | "copy-files"
  | "move-files"
  | "move-to-trash"
  | "permanent-delete"
  | "view-tree"
  | "view-icons"
  | "sort-name"
  | "sort-size"
  | "sort-type"
  | "sort-modified"
  | "toggle-sort-direction"
  | "toggle-main-toolbar"
  | "toggle-location-toolbar"
  | "back"
  | "forward"
  | "up"
  | "home"
  | "about-konqueror"
  | "about-kde";

export type KonquerorApplicationMenuCheckKind = "radio" | "checkbox";

/** Visual vocabulary intentionally limited to existing KDE-style Konqueror icons. */
export type KonquerorApplicationMenuIcon = "bookmark" | "folder" | "new-folder" | "bookmark-tabs" | "edit";

export type KonquerorApplicationMenuActionEntry = {
  readonly kind: "action";
  readonly action: KonquerorApplicationMenuAction;
  readonly label: string;
  readonly enabled: boolean;
  readonly title: string;
  readonly shortcut?: string;
  /** Stable Folder target for dynamic Bookmarks actions; absent means the root container. */
  readonly parentFolderId?: KonquerorBookmarkFolderId | null;
  /** Stable Bookmark target for a dynamic Bookmark leaf action. */
  readonly bookmarkId?: KonquerorBookmarkNodeId;
  readonly checked?: boolean;
  readonly checkKind?: KonquerorApplicationMenuCheckKind;
  readonly icon?: KonquerorApplicationMenuIcon;
};

export type KonquerorApplicationMenuSubmenuId = string;

export type KonquerorApplicationMenuSubmenuEntry = {
  readonly kind: "submenu";
  readonly id: KonquerorApplicationMenuSubmenuId;
  readonly label: string;
  readonly enabled: boolean;
  readonly title: string;
  readonly items: readonly KonquerorApplicationMenuEntry[];
  readonly icon?: KonquerorApplicationMenuIcon;
};

export type KonquerorApplicationMenuEntry =
  | { readonly kind: "separator" }
  | KonquerorApplicationMenuActionEntry
  | KonquerorApplicationMenuSubmenuEntry;

export type KonquerorApplicationMenuAvailability = {
  readonly canUndo?: boolean;
  readonly undoTitle?: string;
  readonly canPrint: boolean;
  readonly printTitle: string;
  readonly canCreateNewFolder: boolean;
  readonly createNewFolderTitle: string;
  readonly canCreateNewTextFile: boolean;
  readonly createNewTextFileTitle: string;
  readonly canOpen: boolean;
  readonly openTitle: string;
  readonly canEdit: boolean;
  readonly editTitle: string;
  readonly canShowProperties: boolean;
  readonly propertiesTitle: string;
  readonly canRename: boolean;
  readonly renameTitle: string;
  readonly canCut: boolean;
  readonly cutTitle: string;
  readonly canCopy: boolean;
  readonly copyTitle: string;
  readonly canPaste: boolean;
  readonly pasteTitle: string;
  readonly canCopyFiles: boolean;
  readonly copyFilesTitle: string;
  readonly canMoveFiles: boolean;
  readonly moveFilesTitle: string;
  readonly canMoveToTrash: boolean;
  readonly moveToTrashTitle: string;
  readonly canRestore: boolean;
  readonly restoreTitle: string;
  readonly canDeletePermanently: boolean;
  readonly deletePermanentlyTitle: string;
  readonly canEmptyTrash: boolean;
  readonly emptyTrashTitle: string;
  readonly canGoBack: boolean;
  readonly backTitle: string;
  readonly canGoForward: boolean;
  readonly forwardTitle: string;
  readonly canGoUp: boolean;
  readonly upTitle: string;
  readonly canGoHome: boolean;
  readonly homeTitle: string;
  readonly viewControlsDisabled: boolean;
  readonly canOpenTerminal: boolean;
  readonly openTerminalTitle: string;
  readonly canDetachCurrentTab: boolean;
  readonly canCloseCurrentTab: boolean;
  readonly canAddBookmark?: boolean;
  readonly addBookmarkTitle?: string;
  readonly canCreateBookmarkFolder?: boolean;
  readonly createBookmarkFolderTitle?: string;
  readonly canBookmarkTabsAsFolder?: boolean;
  readonly bookmarkTabsAsFolderTitle?: string;
  readonly canEditBookmarks?: boolean;
  readonly editBookmarksTitle?: string;
  readonly canMediaPlay?: boolean;
  readonly canMediaPause?: boolean;
  readonly canMediaStop?: boolean;
  readonly canMediaPrevious?: boolean;
  readonly canMediaNext?: boolean;
  readonly isMainToolbarVisible: boolean;
  readonly isLocationToolbarVisible: boolean;
};

const separator = { kind: "separator" } as const;

const action = (
  key: KonquerorApplicationMenuAction,
  label: string,
  enabled = true,
  title = label,
  checked?: boolean,
  checkKind?: KonquerorApplicationMenuCheckKind,
  shortcut?: string,
  parentFolderId?: KonquerorBookmarkFolderId | null,
  bookmarkId?: KonquerorBookmarkNodeId,
  icon?: KonquerorApplicationMenuIcon,
): KonquerorApplicationMenuActionEntry => ({
  kind: "action",
  action: key,
  label,
  enabled,
  title,
  shortcut,
  parentFolderId,
  bookmarkId,
  checked,
  checkKind,
  icon,
});

const submenu = (
  id: KonquerorApplicationMenuSubmenuId,
  label: string,
  enabled: boolean,
  title: string,
  items: KonquerorApplicationMenuSubmenuEntry["items"],
  icon?: KonquerorApplicationMenuIcon,
): KonquerorApplicationMenuSubmenuEntry => ({ kind: "submenu", id, label, enabled, title, items, icon });

const getBookmarkFolderSubmenu = (
  folder: Extract<KonquerorBookmarkNode, { readonly type: "folder" }>,
  availability: KonquerorApplicationMenuAvailability,
): KonquerorApplicationMenuSubmenuEntry => {
  const canAddBookmark = availability.canAddBookmark ?? false;
  const canCreateFolder = availability.canCreateBookmarkFolder ?? true;
  const canBookmarkTabsAsFolder = availability.canBookmarkTabsAsFolder ?? false;

  return submenu(
    `bookmark-folder-${folder.id}`,
    folder.name,
    true,
    folder.name,
    [
      ...folder.children.map((child) => getBookmarkMenuEntry(child, availability)),
      ...(folder.children.length > 0 ? [separator] : []),
      action(
        "add-bookmark",
        "Add Bookmark",
        canAddBookmark,
        availability.addBookmarkTitle ?? "Add Bookmark",
        undefined,
        undefined,
        undefined,
        folder.id,
        undefined,
        "bookmark",
      ),
      action(
        "bookmark-tabs-as-folder",
        "Bookmark Tabs as Folder...",
        canBookmarkTabsAsFolder,
        availability.bookmarkTabsAsFolderTitle ?? "Bookmark Tabs as Folder",
        undefined,
        undefined,
        undefined,
        folder.id,
        undefined,
        "bookmark-tabs",
      ),
      action(
        "new-bookmark-folder",
        "New Bookmark Folder...",
        canCreateFolder,
        availability.createBookmarkFolderTitle ?? "New Bookmark Folder",
        undefined,
        undefined,
        undefined,
        folder.id,
        undefined,
        "new-folder",
      ),
    ],
    "folder",
  );
};

const getBookmarkMenuEntry = (
  node: KonquerorBookmarkNode,
  availability: KonquerorApplicationMenuAvailability,
): KonquerorApplicationMenuEntry => isKonquerorBookmarkFolder(node)
  ? getBookmarkFolderSubmenu(node, availability)
  : action("open-bookmark", node.name, true, node.name, undefined, undefined, undefined, undefined, node.id, "bookmark");

const getBookmarkMenuEntries = (
  availability: KonquerorApplicationMenuAvailability,
  rootChildren: readonly KonquerorBookmarkNode[],
): readonly KonquerorApplicationMenuEntry[] => {
  const canAddBookmark = availability.canAddBookmark ?? false;
  const canCreateFolder = availability.canCreateBookmarkFolder ?? true;
  const canBookmarkTabsAsFolder = availability.canBookmarkTabsAsFolder ?? false;

  return [
    action("add-bookmark", "Add Bookmark", canAddBookmark, availability.addBookmarkTitle ?? "Add Bookmark", undefined, undefined, "Ctrl+B", undefined, undefined, "bookmark"),
    action(
      "bookmark-tabs-as-folder",
      "Bookmark Tabs as Folder...",
      canBookmarkTabsAsFolder,
      availability.bookmarkTabsAsFolderTitle ?? "Bookmark Tabs as Folder",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "bookmark-tabs",
    ),
    action("edit-bookmarks", "Edit Bookmarks", availability.canEditBookmarks ?? true, availability.editBookmarksTitle ?? "Edit Bookmarks", undefined, undefined, undefined, undefined, undefined, "edit"),
    action(
      "new-bookmark-folder",
      "New Bookmark Folder...",
      canCreateFolder,
      availability.createBookmarkFolderTitle ?? "New Bookmark Folder",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "new-folder",
    ),
    ...(rootChildren.length > 0 ? [separator, ...rootChildren.map((node) => getBookmarkMenuEntry(node, availability))] : []),
  ];
};

const sortAction = (key: KonquerorSortKey): KonquerorApplicationMenuAction => {
  switch (key) {
    case "name": return "sort-name";
    case "size": return "sort-size";
    case "type": return "sort-type";
    case "modified": return "sort-modified";
  }
};

const sortLabel = (key: KonquerorSortKey): string => {
  switch (key) {
    case "name": return "By Name";
    case "size": return "By Size";
    case "type": return "By Type";
    case "modified": return "By Date";
  }
};

export function getKonquerorApplicationMenuEntries(
  menu: KonquerorApplicationMenu,
  availability: KonquerorApplicationMenuAvailability,
  viewMode: KonquerorResourceViewMode,
  sort: { readonly key: KonquerorSortKey; readonly direction: KonquerorSortDirection },
  bookmarkRootChildren: readonly KonquerorBookmarkNode[] = [],
): readonly KonquerorApplicationMenuEntry[] {
  if (menu === "location") {
    return [
      action("new-window", "New Window"),
      action("new-tab", "New Tab"),
      separator,
      action("print", "Print", availability.canPrint, availability.printTitle),
      separator,
      action("close", "Quit"),
    ];
  }

  if (menu === "edit") {
    return [
      action("undo", "Undo", availability.canUndo ?? false, availability.undoTitle ?? "No file operation is available to undo"),
      action("cut", "Cut", availability.canCut, availability.cutTitle),
      action("copy", "Copy", availability.canCopy, availability.copyTitle),
      action("paste", "Paste", availability.canPaste, availability.pasteTitle),
      action("rename", "Rename", availability.canRename, availability.renameTitle),
      action("move-to-trash", "Move to Trash", availability.canMoveToTrash, availability.moveToTrashTitle),
      action(
        "permanent-delete",
        "Delete",
        availability.canDeletePermanently,
        availability.deletePermanentlyTitle,
      ),
      action("copy-files", "Copy Files", availability.canCopyFiles, availability.copyFilesTitle),
      action("move-files", "Move Files", availability.canMoveFiles, availability.moveFilesTitle),
      submenu(
        "create-new",
        "Create New",
        availability.canCreateNewFolder || availability.canCreateNewTextFile,
        availability.canCreateNewFolder || availability.canCreateNewTextFile
          ? "Create New"
          : availability.createNewFolderTitle,
        [
          action("new-folder", "Folder", availability.canCreateNewFolder, availability.createNewFolderTitle),
          separator,
          action("new-text-file", "Text File", availability.canCreateNewTextFile, availability.createNewTextFileTitle),
        ],
      ),
      action("properties", "Properties", availability.canShowProperties, availability.propertiesTitle),
    ];
  }

  if (menu === "view") {
    const enabled = !availability.viewControlsDisabled;

    return [
      submenu("view-mode", "View Mode", enabled, "View Mode", [
        action("view-tree", "Tree View", enabled, "Tree View", viewMode === "tree", "radio"),
        action("view-icons", "Icon View", enabled, "Icon View", viewMode === "icons", "radio"),
      ]),
      separator,
      submenu("sort", "Sort", enabled, "Sort", [
        ...(["name", "size", "type", "modified"] as const).map((key) =>
          action(sortAction(key), sortLabel(key), enabled, sortLabel(key), sort.key === key, "radio"),
        ),
        separator,
        action(
          "toggle-sort-direction",
          "Descending",
          enabled,
          "Descending",
          sort.direction === "descending",
          "checkbox",
        ),
      ]),
    ];
  }

  if (menu === "go") {
    return [
      action("back", "Back", availability.canGoBack, availability.backTitle),
      action("forward", "Forward", availability.canGoForward, availability.forwardTitle),
      action("up", "Up", availability.canGoUp, availability.upTitle),
      action("home", "Home", availability.canGoHome, availability.homeTitle),
    ];
  }

  if (menu === "bookmarks") {
    return getBookmarkMenuEntries(availability, bookmarkRootChildren);
  }

  if (menu === "player") {
    return [
      action("play", "Play", availability.canMediaPlay ?? false, "Play"),
      action("pause", "Pause", availability.canMediaPause ?? false, "Pause"),
      action("stop", "Stop", availability.canMediaStop ?? false, "Stop"),
      action("next", "Next", availability.canMediaNext ?? false, "Next"),
      action("previous", "Previous", availability.canMediaPrevious ?? false, "Previous"),
    ];
  }

  if (menu === "tools") {
    return [
      action("open-terminal", "Open Terminal", availability.canOpenTerminal, availability.openTerminalTitle),
      action("find-file", "Find File..."),
    ];
  }

  if (menu === "settings") {
    return [
      submenu("toolbars", "Toolbars", true, "Toolbars", [
        action(
          "toggle-main-toolbar",
          "Main Toolbar (Konqueror)",
          true,
          "Main Toolbar (Konqueror)",
          availability.isMainToolbarVisible,
          "checkbox",
        ),
        action(
          "toggle-location-toolbar",
          "Location Toolbar (Konqueror)",
          true,
          "Location Toolbar (Konqueror)",
          availability.isLocationToolbarVisible,
          "checkbox",
        ),
      ]),
    ];
  }

  if (menu === "window") {
    return [
      action("new-tab", "New Tab"),
      action("duplicate-current-tab", "Duplicate Current Tab"),
      action("detach-current-tab", "Detach Current Tab", availability.canDetachCurrentTab, availability.canDetachCurrentTab ? "Detach Current Tab" : "Keep at least one tab in this window"),
      action("close-current-tab", "Close Current Tab", availability.canCloseCurrentTab, availability.canCloseCurrentTab ? "Close Current Tab" : "Keep at least one tab in this window"),
    ];
  }

  if (menu === "help") {
    return [
      action("about-konqueror", "About Konqueror"),
      action("about-kde", "About KDE"),
    ];
  }

  return [];
}
