import type { VfsFileNode, VfsNode, VfsNodeId } from "../../vfs/types";
import type { ScreenArea, WorkArea } from "../../window-manager/types";
export { getKonquerorSubmenuPosition } from "./applicationMenuPosition";
import {
  getAvailableKonquerorPreviewers,
  getDefaultKonquerorPreviewer,
  type KonquerorPreviewerId,
} from "./previewModel";

export type KonquerorContextMenuState =
  | {
      readonly kind: "item";
      readonly requestId: number;
      /** The item physically clicked to open this request. */
      readonly clickedNodeId: VfsNodeId;
      /** Ordered selection group frozen when the item menu opened. */
      readonly targetNodeIds: readonly VfsNodeId[];
      readonly clientX: number;
      readonly clientY: number;
    }
  | {
      readonly kind: "background";
      readonly requestId: number;
      readonly directoryNodeId: VfsNodeId;
      readonly clientX: number;
      readonly clientY: number;
    }
  | {
      readonly kind: "preview";
      readonly requestId: number;
      readonly nodeId: VfsNodeId;
      readonly clientX: number;
      readonly clientY: number;
    }
  | null;

export type KonquerorContextMenuAction =
  | "open"
  | "open-in-new-window"
  | "open-in-new-tab"
  | "open-with-kwrite"
  | "preview-embedded-text"
  | "preview-khtml"
  | "preview-markdown"
  | "edit"
  | "rename"
  | "cut"
  | "copy"
  | "paste"
  | "move-to-trash"
  | "restore"
  | "permanent-delete"
  | "empty-trash"
  | "properties"
  | "new-folder"
  | "new-text-file"
  | "back"
  | "forward"
  | "up"
  | "copy-to"
  | "move-to"
  | "open-terminal-here";

export type KonquerorContextMenuActionEntry = {
  readonly kind: "action";
  readonly action: KonquerorContextMenuAction;
  readonly label: string;
  readonly enabled: boolean;
  readonly title: string;
  readonly checked?: boolean;
};

export type KonquerorContextMenuSeparatorEntry = { readonly kind: "separator" };

export type KonquerorContextMenuSubmenuEntry = {
  readonly kind: "submenu";
  readonly id: "preview-in" | "open-with" | "actions" | "create-new";
  readonly label: string;
  readonly enabled: boolean;
  readonly title: string;
  readonly items: readonly (KonquerorContextMenuActionEntry | KonquerorContextMenuSeparatorEntry)[];
};

export type KonquerorContextMenuEntry =
  | KonquerorContextMenuSeparatorEntry
  | KonquerorContextMenuActionEntry
  | KonquerorContextMenuSubmenuEntry;

export type KonquerorContextMenuAvailability = {
  readonly canEdit: boolean;
  readonly editTitle: string;
  readonly canRename: boolean;
  readonly renameTitle: string;
  readonly canCut: boolean;
  readonly cutTitle: string;
  readonly canCopy: boolean;
  readonly copyTitle: string;
  readonly canPaste: boolean;
  readonly pasteTitle: string;
  readonly canMoveToTrash: boolean;
  readonly moveToTrashTitle: string;
  readonly canRestore: boolean;
  readonly restoreTitle: string;
  readonly canDeletePermanently: boolean;
  readonly deletePermanentlyTitle: string;
  readonly canEmptyTrash: boolean;
  readonly emptyTrashTitle: string;
  readonly canCreateNewFolder: boolean;
  readonly createNewFolderTitle: string;
  readonly canCreateNewTextFile: boolean;
  readonly createNewTextFileTitle: string;
  readonly canGoBack: boolean;
  readonly backTitle: string;
  readonly canGoForward: boolean;
  readonly forwardTitle: string;
  readonly canGoUp: boolean;
  readonly upTitle: string;
  readonly canShowCurrentDirectoryProperties: boolean;
  readonly currentDirectoryPropertiesTitle: string;
  readonly canCopyTo: boolean;
  readonly copyToTitle: string;
  readonly canMoveTo: boolean;
  readonly moveToTitle: string;
};

export type KonquerorPreviewContextMenuAvailability = Pick<
  KonquerorContextMenuAvailability,
  "canCopyTo" | "copyToTitle" | "canMoveTo" | "moveToTitle"
>;

const separator: KonquerorContextMenuSeparatorEntry = { kind: "separator" };

const action = (
  key: KonquerorContextMenuAction,
  label: string,
  enabled = true,
  title = label,
): KonquerorContextMenuActionEntry => ({ kind: "action", action: key, label, enabled, title });

const previewActionFor = (previewerId: KonquerorPreviewerId): KonquerorContextMenuAction => {
  switch (previewerId) {
    case "khtml": return "preview-khtml";
    case "markdown": return "preview-markdown";
    default: return "preview-embedded-text";
  }
};

const previewSubmenu = (
  node: VfsFileNode,
  checkedPreviewerId: KonquerorPreviewerId,
): KonquerorContextMenuEntry => ({
  kind: "submenu",
  id: "preview-in",
  label: "Preview In",
  title: "Preview In",
  enabled: true,
  items: getAvailableKonquerorPreviewers(node).map((previewer) => ({
    ...action(previewActionFor(previewer.id), previewer.label),
    checked: previewer.id === checkedPreviewerId,
  })),
});

const openWithSubmenu = (): KonquerorContextMenuEntry => ({
  kind: "submenu",
  id: "open-with",
  label: "Open With",
  title: "Open With",
  enabled: true,
  items: [action("open-with-kwrite", "KWrite")],
});

const actionsSubmenu = (): KonquerorContextMenuEntry => ({
  kind: "submenu",
  id: "actions",
  label: "Actions",
  title: "Actions",
  enabled: true,
  items: [action("open-terminal-here", "Open Terminal Here")],
});

const createNewSubmenu = (availability: KonquerorContextMenuAvailability): KonquerorContextMenuSubmenuEntry => ({
  kind: "submenu",
  id: "create-new",
  label: "Create New",
  title: "Create New",
  enabled: availability.canCreateNewFolder || availability.canCreateNewTextFile,
  items: [
    action("new-folder", "Folder", availability.canCreateNewFolder, availability.createNewFolderTitle),
    separator,
    action("new-text-file", "Text File", availability.canCreateNewTextFile, availability.createNewTextFileTitle),
  ],
});

const filePreviewEntries = (availability: KonquerorPreviewContextMenuAvailability): readonly KonquerorContextMenuEntry[] => [
  openWithSubmenu(),
  separator,
  action("copy-to", "Copy To", availability.canCopyTo, availability.copyToTitle),
  action("move-to", "Move To", availability.canMoveTo, availability.moveToTitle),
];

export function getKonquerorItemContextMenuEntries(
  isTrashRoot: boolean,
  node: VfsNode,
  availability: KonquerorContextMenuAvailability,
  canCreateChild: boolean,
  previewableFile?: VfsFileNode,
  canOpenTerminalHere = !isTrashRoot,
): readonly KonquerorContextMenuEntry[] {
  if (!isTrashRoot && node.kind === "file") {
    return [
      action("open-in-new-window", "Open in New Window"),
      action("open-in-new-tab", "Open in New Tab"),
      separator,
      action("cut", "Cut", availability.canCut, availability.cutTitle),
      action("copy", "Copy", availability.canCopy, availability.copyTitle),
      action("rename", "Rename", availability.canRename, availability.renameTitle),
      action("move-to-trash", "Move to Trash", availability.canMoveToTrash, availability.moveToTrashTitle),
      separator,
      openWithSubmenu(),
      previewSubmenu(node, getDefaultKonquerorPreviewer(node)),
      separator,
      action("copy-to", "Copy To", availability.canCopyTo, availability.copyToTitle),
      action("move-to", "Move To", availability.canMoveTo, availability.moveToTitle),
      separator,
      action("properties", "Properties"),
    ];
  }

  const file = node.kind === "file" ? node : previewableFile;
  const fileEntries = file
    ? [
        action("open", "Open"),
        action("open-in-new-window", "Open in New Window"),
        action("open-in-new-tab", "Open in New Tab"),
        separator,
        previewSubmenu(file, getDefaultKonquerorPreviewer(file)),
        openWithSubmenu(),
      ]
    : [
        action("open", "Open"),
        action("open-in-new-window", "Open in New Window"),
        action("open-in-new-tab", "Open in New Tab"),
      ];
  if (isTrashRoot) {
    return [
      ...fileEntries,
      separator,
      action("restore", "Restore", availability.canRestore, availability.restoreTitle),
      action(
        "permanent-delete",
        "Permanent Delete",
        availability.canDeletePermanently,
        availability.deletePermanentlyTitle,
      ),
      separator,
      action("properties", "Properties"),
    ];
  }

  return [
    ...fileEntries,
    ...(!isTrashRoot && node.kind === "directory" && canCreateChild
      ? [separator, action("new-folder", "Create Folder")]
      : []),
    separator,
    action("rename", "Rename", availability.canRename, availability.renameTitle),
    action("cut", "Cut", availability.canCut, availability.cutTitle),
    action("copy", "Copy", availability.canCopy, availability.copyTitle),
    ...(node.kind === "directory" && canOpenTerminalHere ? [separator, actionsSubmenu()] : []),
    separator,
    action("move-to-trash", "Move to Trash", availability.canMoveToTrash, availability.moveToTrashTitle),
    separator,
    action("properties", "Properties"),
  ];
}

export function getKonquerorPreviewContextMenuEntries(
  availability: KonquerorPreviewContextMenuAvailability,
): readonly KonquerorContextMenuEntry[] {
  return filePreviewEntries(availability);
}

export function getKonquerorBackgroundContextMenuEntries(
  isTrashRoot: boolean,
  availability: KonquerorContextMenuAvailability,
  canOpenTerminalHere = !isTrashRoot,
): readonly KonquerorContextMenuEntry[] {
  if (isTrashRoot) {
    return [action("empty-trash", "Empty Trash", availability.canEmptyTrash, availability.emptyTrashTitle)];
  }

  return [
    createNewSubmenu(availability),
    separator,
    action("up", "Up", availability.canGoUp, availability.upTitle),
    action("back", "Back", availability.canGoBack, availability.backTitle),
    action("forward", "Forward", availability.canGoForward, availability.forwardTitle),
    separator,
    action("paste", "Paste Clipboard Contents", availability.canPaste, availability.pasteTitle),
    ...(canOpenTerminalHere ? [separator, actionsSubmenu()] : []),
    action("copy-to", "Copy To", availability.canCopyTo, availability.copyToTitle),
    action("move-to", "Move To", availability.canMoveTo, availability.moveToTitle),
    separator,
    action(
      "properties",
      "Properties",
      availability.canShowCurrentDirectoryProperties,
      availability.currentDirectoryPropertiesTitle,
    ),
  ];
}

export type KonquerorPopupPosition = {
  readonly left: number;
  readonly top: number;
};

export type KonquerorPopupBounds = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export function getKonquerorPopupLocalPosition(
  requested: { readonly clientX: number; readonly clientY: number },
  origin: { readonly left: number; readonly top: number },
): KonquerorPopupPosition {
  return {
    left: requested.clientX - origin.left,
    top: requested.clientY - origin.top,
  };
}

export function getKonquerorWorkAreaLocalBounds(
  workArea: WorkArea,
  origin: { readonly left: number; readonly top: number },
): KonquerorPopupBounds {
  return {
    left: workArea.x - origin.left,
    top: workArea.y - origin.top,
    width: Math.max(0, workArea.width),
    height: Math.max(0, workArea.height),
  };
}

export function getKonquerorScreenAreaLocalBounds(
  screenArea: ScreenArea,
  origin: { readonly left: number; readonly top: number },
): KonquerorPopupBounds {
  return {
    left: screenArea.x - origin.left,
    top: screenArea.y - origin.top,
    width: Math.max(0, screenArea.width),
    height: Math.max(0, screenArea.height),
  };
}

export function clampKonquerorContextMenuPosition(
  requested: KonquerorPopupPosition,
  popup: { readonly width: number; readonly height: number },
  bounds: KonquerorPopupBounds,
): KonquerorPopupPosition {
  const maximumLeft = Math.max(bounds.left, bounds.left + bounds.width - Math.max(0, popup.width));
  const maximumTop = Math.max(bounds.top, bounds.top + bounds.height - Math.max(0, popup.height));

  return {
    left: Math.round(Math.min(Math.max(requested.left, bounds.left), maximumLeft)),
    top: Math.round(Math.min(Math.max(requested.top, bounds.top), maximumTop)),
  };
}
