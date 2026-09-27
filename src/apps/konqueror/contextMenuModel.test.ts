import { describe, expect, it } from "vitest";
import type { VfsDirectoryNode, VfsLinkNode, VfsTextFileNode } from "../../vfs/types";
import {
  clampKonquerorContextMenuPosition,
  getKonquerorPopupLocalPosition,
  getKonquerorScreenAreaLocalBounds,
  getKonquerorWorkAreaLocalBounds,
  getKonquerorBackgroundContextMenuEntries,
  getKonquerorItemContextMenuEntries,
  getKonquerorPreviewContextMenuEntries,
  getKonquerorSubmenuPosition,
  type KonquerorContextMenuAvailability,
} from "./contextMenuModel";

const availability: KonquerorContextMenuAvailability = {
  canEdit: false,
  editTitle: "Open a text file before editing",
  canRename: true,
  renameTitle: "Rename",
  canCut: true,
  cutTitle: "Cut",
  canCopy: true,
  copyTitle: "Copy",
  canPaste: false,
  pasteTitle: "Copy or cut an item before pasting",
  canMoveToTrash: true,
  moveToTrashTitle: "Move to Trash",
  canRestore: true,
  restoreTitle: "Restore",
  canDeletePermanently: true,
  deletePermanentlyTitle: "Delete Permanently",
  canEmptyTrash: false,
  emptyTrashTitle: "The Trash is empty",
  canCreateNewFolder: true,
  createNewFolderTitle: "Create New Folder",
  canCreateNewTextFile: true,
  createNewTextFileTitle: "Create New Text File",
  canGoBack: true,
  backTitle: "Back",
  canGoForward: false,
  forwardTitle: "No forward location",
  canGoUp: true,
  upTitle: "Up",
  canShowCurrentDirectoryProperties: true,
  currentDirectoryPropertiesTitle: "Properties",
  canCopyTo: true,
  copyToTitle: "Copy current folder to another location",
  canMoveTo: true,
  moveToTitle: "Move current folder to another location",
};

const file = (name: string): VfsTextFileNode => ({
  id: `file-${name}`,
  name,
  parentId: "documents",
  kind: "file",
  encoding: "utf-8",
  mimeType: "text/plain",
  content: { kind: "text", text: "preview" },
  size: 7,
  createdAt: "2026-01-01T00:00:00.000Z",
  modifiedAt: "2026-01-01T00:00:00.000Z",
});
const directory: VfsDirectoryNode = { id: "documents", name: "Documents", parentId: "home", kind: "directory", childIds: [], createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z" };
const link: VfsLinkNode = { id: "link-readme", name: "Readme link", parentId: "documents", kind: "link", targetNodeId: "file-README", createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z" };
const labels = (entries: readonly { readonly kind: string; readonly label?: string }[]) => entries.flatMap((entry) => entry.kind === "separator" ? [] : entry.label ?? []);
const submenu = (entries: ReturnType<typeof getKonquerorItemContextMenuEntries>, id: "preview-in" | "open-with" | "actions") => {
  const entry = entries.find((candidate) => candidate.kind === "submenu" && candidate.id === id);
  if (!entry || entry.kind !== "submenu") throw new Error(`Missing ${id}`);
  return entry;
};

describe("Konqueror context menu model", () => {
  it("keeps directory item actions unchanged and gives ordinary files the KDE3 ordered action menu", () => {
    const directoryEntries = getKonquerorItemContextMenuEntries(false, directory, availability, true);
    const fileEntries = getKonquerorItemContextMenuEntries(false, file("README"), availability, false);

    expect(labels(directoryEntries)).toEqual([
      "Open",
      "Open in New Window",
      "Open in New Tab",
      "Create Folder",
      "Rename",
      "Cut",
      "Copy",
      "Actions",
      "Move to Trash",
      "Properties",
    ]);
    expect(labels(fileEntries)).toEqual([
      "Open in New Window",
      "Open in New Tab",
      "Cut",
      "Copy",
      "Rename",
      "Move to Trash",
      "Open With",
      "Preview In",
      "Copy To",
      "Move To",
      "Properties",
    ]);
    expect(directoryEntries.slice(0, 3)).toEqual([
      expect.objectContaining({ action: "open", label: "Open" }),
      expect.objectContaining({ action: "open-in-new-window", label: "Open in New Window" }),
      expect.objectContaining({ action: "open-in-new-tab", label: "Open in New Tab" }),
    ]);
    expect(fileEntries).toEqual([
      expect.objectContaining({ action: "open-in-new-window", label: "Open in New Window" }),
      expect.objectContaining({ action: "open-in-new-tab", label: "Open in New Tab" }),
      { kind: "separator" },
      expect.objectContaining({ action: "cut", label: "Cut" }),
      expect.objectContaining({ action: "copy", label: "Copy" }),
      expect.objectContaining({ action: "rename", label: "Rename" }),
      expect.objectContaining({ action: "move-to-trash", label: "Move to Trash" }),
      { kind: "separator" },
      expect.objectContaining({ kind: "submenu", id: "open-with", label: "Open With" }),
      expect.objectContaining({ kind: "submenu", id: "preview-in", label: "Preview In" }),
      { kind: "separator" },
      expect.objectContaining({ action: "copy-to", label: "Copy To" }),
      expect.objectContaining({ action: "move-to", label: "Move To" }),
      { kind: "separator" },
      expect.objectContaining({ action: "properties", label: "Properties" }),
    ]);
    expect(labels(fileEntries)).not.toContain("Open");
    expect(labels(fileEntries)).not.toContain("Open with");
    expect(labels(fileEntries)).not.toContain("Preview in");
  });

  it("describes deterministic Preview In and Open With submenus by filename extension", () => {
    const html = getKonquerorItemContextMenuEntries(false, file("INDEX.HTML"), availability, false);
    const markdown = getKonquerorItemContextMenuEntries(false, file("README.md"), availability, false);
    expect(submenu(html, "preview-in").items).toMatchObject([
      { action: "preview-khtml", label: "KHTML", checked: true },
      { action: "preview-embedded-text", label: "Embedded Advanced Text Editor", checked: false },
    ]);
    expect(submenu(markdown, "preview-in").items).toMatchObject([
      { action: "preview-markdown", label: "Markdown Renderer", checked: true },
      { action: "preview-embedded-text", label: "Embedded Advanced Text Editor", checked: false },
    ]);
    expect(submenu(html, "open-with").items).toEqual([
      { kind: "action", action: "open-with-kwrite", label: "KWrite", enabled: true, title: "KWrite" },
    ]);
  });

  it("keeps file-content menus limited to Open With, Copy To, and Move To", () => {
    const entries = getKonquerorPreviewContextMenuEntries({
      canCopyTo: true,
      copyToTitle: "Copy current file to another location",
      canMoveTo: false,
      moveToTitle: "The current file cannot be moved",
    });

    expect(entries).toEqual([
      expect.objectContaining({ kind: "submenu", id: "open-with", label: "Open With" }),
      { kind: "separator" },
      expect.objectContaining({ action: "copy-to", label: "Copy To", enabled: true }),
      expect.objectContaining({ action: "move-to", label: "Move To", enabled: false }),
    ]);
    expect(labels(entries)).not.toContain("Open");
    expect(labels(entries)).not.toContain("Open in New Window");
    expect(labels(entries)).not.toContain("Open in New Tab");
    expect(labels(entries)).not.toContain("Preview in");
    expect(labels(entries)).not.toContain("Open with");
    expect(submenu(entries as ReturnType<typeof getKonquerorItemContextMenuEntries>, "open-with").items).toEqual([
      { kind: "action", action: "open-with-kwrite", label: "KWrite", enabled: true, title: "KWrite" },
    ]);
  });

  it("keeps Link mutation commands on the Link while exposing its resolved file previewers", () => {
    const entries = getKonquerorItemContextMenuEntries(false, link, availability, false, file("README.md"));

    expect(labels(entries)).toEqual([
      "Open",
      "Open in New Window",
      "Open in New Tab",
      "Preview In",
      "Open With",
      "Rename",
      "Cut",
      "Copy",
      "Move to Trash",
      "Properties",
    ]);
    expect(labels(entries)).not.toContain("Create Folder");
    expect(submenu(entries, "preview-in").items[0]).toMatchObject({ action: "preview-markdown", checked: true });
  });

  it("uses the existing Trash and expanded background availability predicates", () => {
    const trashItem = getKonquerorItemContextMenuEntries(true, file("Notes.txt"), availability, false);
    const normalBackground = getKonquerorBackgroundContextMenuEntries(false, availability);
    const trashBackground = getKonquerorBackgroundContextMenuEntries(true, availability);

    expect(labels(trashItem)).toEqual(["Open", "Open in New Window", "Open in New Tab", "Preview In", "Open With", "Restore", "Permanent Delete", "Properties"]);
    expect(labels(normalBackground)).toEqual([
      "Create New",
      "Up",
      "Back",
      "Forward",
      "Paste Clipboard Contents",
      "Actions",
      "Copy To",
      "Move To",
      "Properties",
    ]);
    expect(normalBackground).toEqual([
      expect.objectContaining({ kind: "submenu", id: "create-new", label: "Create New" }),
      { kind: "separator" },
      expect.objectContaining({ action: "up", label: "Up", enabled: true }),
      expect.objectContaining({ action: "back", label: "Back", enabled: true }),
      expect.objectContaining({ action: "forward", label: "Forward", enabled: false }),
      { kind: "separator" },
      expect.objectContaining({ action: "paste", label: "Paste Clipboard Contents" }),
      { kind: "separator" },
      expect.objectContaining({ kind: "submenu", id: "actions", label: "Actions" }),
      expect.objectContaining({ action: "copy-to", label: "Copy To", enabled: true }),
      expect.objectContaining({ action: "move-to", label: "Move To", enabled: true }),
      { kind: "separator" },
      expect.objectContaining({ action: "properties", label: "Properties", enabled: true }),
    ]);
    expect(labels(trashBackground)).toEqual(["Empty Trash"]);
    expect(trashBackground).toContainEqual({
      kind: "action",
      action: "empty-trash",
      label: "Empty Trash",
      enabled: false,
      title: "The Trash is empty",
    });
  });

  it("groups only Folder and Text File under Create New with the required separator", () => {
    const entries = getKonquerorBackgroundContextMenuEntries(false, availability);
    const createNew = entries.find((entry) => entry.kind === "submenu" && entry.id === "create-new");
    if (!createNew || createNew.kind !== "submenu") throw new Error("Missing Create New submenu");

    expect(createNew.items).toEqual([
      { kind: "action", action: "new-folder", label: "Folder", enabled: true, title: "Create New Folder" },
      { kind: "separator" },
      { kind: "action", action: "new-text-file", label: "Text File", enabled: true, title: "Create New Text File" },
    ]);
  });

  it("keeps Create Folder available after the Open actions for an eligible ordinary folder", () => {
    const normalFolder = getKonquerorItemContextMenuEntries(false, directory, availability, true);
    const ineligibleFolder = getKonquerorItemContextMenuEntries(false, directory, availability, false);
    const trashFolder = getKonquerorItemContextMenuEntries(true, directory, availability, true);

    expect(normalFolder).toContainEqual(expect.objectContaining({ kind: "action", action: "new-folder", label: "Create Folder" }));
    expect(labels(ineligibleFolder)).not.toContain("Create Folder");
    expect(labels(trashFolder)).not.toContain("Create Folder");
  });

  it("adds exactly one Actions submenu only for ordinary directory and background contexts", () => {
    const normalFolder = getKonquerorItemContextMenuEntries(false, directory, availability, true);
    const normalBackground = getKonquerorBackgroundContextMenuEntries(false, availability);
    const fileEntries = getKonquerorItemContextMenuEntries(false, file("README"), availability, false);
    const trashFolder = getKonquerorItemContextMenuEntries(true, directory, availability, true);
    const nestedTrashFolder = getKonquerorItemContextMenuEntries(false, directory, availability, true, undefined, false);

    expect(submenu(normalFolder, "actions").items).toEqual([
      { kind: "action", action: "open-terminal-here", label: "Open Terminal Here", enabled: true, title: "Open Terminal Here" },
    ]);
    expect(submenu(normalBackground as ReturnType<typeof getKonquerorItemContextMenuEntries>, "actions").items)
      .toMatchObject([{ action: "open-terminal-here" }]);
    expect(labels(fileEntries)).not.toContain("Actions");
    expect(labels(trashFolder)).not.toContain("Actions");
    expect(labels(nestedTrashFolder)).not.toContain("Actions");
  });

  it("keeps preview-page transfer availability independent from its removed previewer actions", () => {
    const entries = getKonquerorPreviewContextMenuEntries({
      canCopyTo: false,
      copyToTitle: "The current file cannot be copied",
      canMoveTo: true,
      moveToTitle: "Move current file to another location",
    });
    expect(labels(entries)).toEqual(["Open With", "Copy To", "Move To"]);
    expect(entries).toContainEqual(expect.objectContaining({ action: "copy-to", enabled: false }));
    expect(entries).toContainEqual(expect.objectContaining({ action: "move-to", enabled: true }));
    expect(labels(entries)).not.toContain("Preview In");
  });

  it("clamps pointer placement inside the desktop work area rather than the Konqueror client", () => {
    const workAreaBounds = { left: -180, top: -96, width: 1024, height: 722 };
    expect(
      clampKonquerorContextMenuPosition({ left: 410, top: 290 }, { width: 160, height: 110 }, workAreaBounds),
    ).toEqual({ left: 410, top: 290 });
    expect(
      clampKonquerorContextMenuPosition({ left: 790, top: 660 }, { width: 160, height: 110 }, workAreaBounds),
    ).toEqual({ left: 684, top: 516 });
    expect(
      clampKonquerorContextMenuPosition({ left: -250, top: -120 }, { width: 160, height: 110 }, workAreaBounds),
    ).toEqual({ left: -180, top: -96 });
    expect(
      clampKonquerorContextMenuPosition({ left: 20, top: 30 }, { width: 1200, height: 800 }, workAreaBounds),
    ).toEqual({ left: -180, top: -96 });
  });

  it("flips a nested menu only at the desktop work-area edge and clamps vertically there", () => {
    expect(getKonquerorSubmenuPosition({ left: 700, top: 680, right: 860 }, { width: 160, height: 110 }, { left: 0, top: 0, right: 844, bottom: 722 }))
      .toEqual({ opensLeft: true, offsetX: 0, offsetY: -66 });
    expect(getKonquerorSubmenuPosition({ left: 20, top: 20, right: 120 }, { width: 160, height: 110 }, { left: 0, top: 0, right: 500, bottom: 360 }))
      .toEqual({ opensLeft: false, offsetX: 0, offsetY: 0 });
  });

  it("keeps a left-flipped submenu inside the client surface after its content width grows", () => {
    expect(getKonquerorSubmenuPosition({ left: 70, top: 24, right: 170 }, { width: 180, height: 90 }, { left: 0, top: 0, right: 220, bottom: 180 }))
      .toEqual({ opensLeft: true, offsetX: 108, offsetY: 0 });
  });

  it("converts browser client coordinates into popup-layer coordinates without directory scroll offsets", () => {
    expect(getKonquerorPopupLocalPosition({ clientX: 412, clientY: 287 }, { left: 180, top: 96 })).toEqual({
      left: 232,
      top: 191,
    });
  });

  it("derives work-area bounds from the window-owned popup layer DOMRect", () => {
    expect(
      getKonquerorWorkAreaLocalBounds(
        { x: 0, y: 0, width: 1024, height: 722, titleBarHeight: 22 },
        { left: 180, top: 96 },
      ),
    ).toEqual({ left: -180, top: -96, width: 1024, height: 722 });
  });

  it("uses the full screen bounds for context menus and nested submenus", () => {
    const screenBounds = getKonquerorScreenAreaLocalBounds(
      { x: 0, y: 0, width: 1024, height: 768 },
      { left: 180, top: 96 },
    );
    expect(screenBounds).toEqual({ left: -180, top: -96, width: 1024, height: 768 });
    expect(
      clampKonquerorContextMenuPosition({ left: 790, top: 660 }, { width: 160, height: 110 }, screenBounds),
    ).toEqual({ left: 684, top: 562 });
    expect(
      getKonquerorSubmenuPosition(
        { left: 700, top: 680, right: 860 },
        { width: 160, height: 110 },
        { left: 0, top: 0, right: 844, bottom: 768 },
      ),
    ).toEqual({ opensLeft: true, offsetX: 0, offsetY: -20 });
  });
});
