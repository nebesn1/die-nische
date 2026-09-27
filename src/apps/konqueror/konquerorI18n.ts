import type { Translator } from "../../i18n/I18nContext";
import type { TranslationKey } from "../../i18n/messages/en";
import type {
  KonquerorApplicationMenuAction,
  KonquerorApplicationMenuEntry,
  KonquerorApplicationMenuSubmenuEntry,
} from "./applicationMenuModel";
import type {
  KonquerorContextMenuAction,
  KonquerorContextMenuEntry,
} from "./contextMenuModel";

const applicationActionKeys: Partial<Record<KonquerorApplicationMenuAction, TranslationKey>> = {
  "new-window": "konqueror.menu.newWindow",
  "new-tab": "konqueror.menu.newTab",
  print: "konqueror.menu.print",
  close: "konqueror.menu.quit",
  undo: "konqueror.menu.undo",
  cut: "konqueror.menu.cut",
  copy: "konqueror.menu.copy",
  paste: "konqueror.menu.paste",
  rename: "konqueror.menu.rename",
  "move-to-trash": "konqueror.menu.moveToTrash",
  "permanent-delete": "konqueror.menu.delete",
  "copy-files": "konqueror.menu.copyFiles",
  "move-files": "konqueror.menu.moveFiles",
  "new-folder": "konqueror.menu.folder",
  "new-text-file": "konqueror.menu.textFile",
  properties: "konqueror.menu.properties",
  "view-tree": "konqueror.menu.treeView",
  "view-icons": "konqueror.menu.iconView",
  "sort-name": "konqueror.menu.byName",
  "sort-size": "konqueror.menu.bySize",
  "sort-type": "konqueror.menu.byType",
  "sort-modified": "konqueror.menu.byDate",
  "toggle-sort-direction": "konqueror.menu.descending",
  back: "konqueror.menu.back",
  forward: "konqueror.menu.forward",
  up: "konqueror.menu.up",
  home: "konqueror.menu.home",
  "add-bookmark": "konqueror.menu.addBookmark",
  "bookmark-tabs-as-folder": "konqueror.menu.bookmarkTabs",
  "edit-bookmarks": "konqueror.menu.editBookmarks",
  "new-bookmark-folder": "konqueror.menu.newBookmarkFolder",
  play: "konqueror.menu.play",
  pause: "konqueror.menu.pause",
  stop: "konqueror.menu.stop",
  next: "konqueror.menu.next",
  previous: "konqueror.menu.previous",
  "open-terminal": "konqueror.menu.openTerminal",
  "find-file": "konqueror.menu.findFile",
  "duplicate-current-tab": "konqueror.menu.duplicateTab",
  "detach-current-tab": "konqueror.menu.detachTab",
  "close-current-tab": "konqueror.menu.closeTab",
  "about-konqueror": "konqueror.menu.aboutKonqueror",
  "about-kde": "konqueror.menu.aboutKde",
};

const applicationSubmenuKeys: Readonly<Record<string, TranslationKey>> = {
  "create-new": "konqueror.menu.createNew",
  "view-mode": "konqueror.menu.viewMode",
  sort: "konqueror.menu.sort",
  toolbars: "konqueror.menu.toolbars",
};

const contextActionKeys: Partial<Record<KonquerorContextMenuAction, TranslationKey>> = {
  open: "konqueror.context.open",
  "open-in-new-window": "konqueror.context.openNewWindow",
  "open-in-new-tab": "konqueror.context.openNewTab",
  "preview-embedded-text": "konqueror.context.previewEmbedded",
  "preview-khtml": "konqueror.context.previewKhtml",
  "preview-markdown": "konqueror.context.previewMarkdown",
  "open-terminal-here": "konqueror.context.openTerminalHere",
  "new-folder": "konqueror.context.newFolder",
  "new-text-file": "konqueror.context.newTextFile",
  paste: "konqueror.context.pasteClipboard",
  "copy-to": "konqueror.context.copyTo",
  "move-to": "konqueror.context.moveTo",
  restore: "konqueror.context.restore",
  "permanent-delete": "konqueror.context.permanentDelete",
  "empty-trash": "konqueror.context.emptyTrash",
};

const contextSubmenuKeys: Readonly<Record<string, TranslationKey>> = {
  "preview-in": "konqueror.context.previewIn",
  "open-with": "konqueror.context.openWith",
  actions: "konqueror.context.actions",
  "create-new": "konqueror.context.createNew",
};

function translateLabel(t: Translator, label: string, key: TranslationKey | undefined): string {
  return key ? t(key) : label;
}

function translateMenuTitle(t: Translator, title: string, key: TranslationKey | undefined): string {
  return key ? t(key) : translateKonquerorAvailabilityText(t, title);
}

/** Availability text is produced by domain helpers; translate only known UI-owned phrases. */
export function translateKonquerorAvailabilityText(t: Translator, text: string): string {
  const selectedCopy = /^Copied: (.+)$/.exec(text);
  if (selectedCopy) {
    const many = /^(\d+) selected items$/.exec(selectedCopy[1] ?? "");
    return many
      ? t("konqueror.status.copiedSelectionMany", { count: many[1] })
      : t("konqueror.status.copiedSelectionOne", { name: selectedCopy[1] ?? "" });
  }
  const readyToMove = /^Ready to move: (.+)$/.exec(text);
  if (readyToMove) {
    const many = /^(\d+) selected items$/.exec(readyToMove[1] ?? "");
    return many
      ? t("konqueror.status.readyToMoveMany", { count: many[1] })
      : t("konqueror.status.readyToMoveOne", { name: readyToMove[1] ?? "" });
  }
  const movedToTrash = /^Moved (.+) to the Trash$/.exec(text);
  if (movedToTrash) {
    const many = /^(\d+) items$/.exec(movedToTrash[1] ?? "");
    return many
      ? t("konqueror.status.movedToTrashMany", { count: many[1] })
      : t("konqueror.status.movedToTrashOne", { name: movedToTrash[1] ?? "" });
  }
  const copiedOrMoved = /^(Copied|Moved) (.+) to (.+)$/.exec(text);
  if (copiedOrMoved) {
    const many = /^(\d+) items$/.exec(copiedOrMoved[2] ?? "");
    const key = copiedOrMoved[1] === "Copied"
      ? many ? "konqueror.status.copiedToMany" : "konqueror.status.copiedToOne"
      : many ? "konqueror.status.movedToMany" : "konqueror.status.movedToOne";
    return many
      ? t(key, { count: many[1], destination: copiedOrMoved[3] ?? "" })
      : t(key, { name: copiedOrMoved[2] ?? "", destination: copiedOrMoved[3] ?? "" });
  }
  const createdLinks = /^Created (?:a link|([0-9]+) links) in (.+)$/.exec(text);
  if (createdLinks) {
    return createdLinks[1]
      ? t("konqueror.status.createdLinkMany", { count: createdLinks[1], destination: createdLinks[2] ?? "" })
      : t("konqueror.status.createdLinkOne", { destination: createdLinks[2] ?? "" });
  }
  const restored = /^Restored (.+)$/.exec(text);
  if (restored) {
    const many = /^(\d+) items$/.exec(restored[1] ?? "");
    return many
      ? t("konqueror.status.restoredMany", { count: many[1] })
      : t("konqueror.status.restoredOne", { name: restored[1] ?? "" });
  }
  const permanentlyDeleted = /^Permanently deleted (.+)$/.exec(text);
  if (permanentlyDeleted) {
    const many = /^(\d+) items$/.exec(permanentlyDeleted[1] ?? "");
    return many
      ? t("konqueror.status.permanentlyDeletedMany", { count: many[1] })
      : t("konqueror.status.permanentlyDeletedOne", { name: permanentlyDeleted[1] ?? "" });
  }
  if (text === "Trash emptied") return t("konqueror.status.trashEmptied");
  if (text === "Undid the last file operation") return t("konqueror.status.undoComplete");
  if (text === "Current folder is no longer available; returned to Home.") return t("konqueror.status.currentFolderUnavailable");
  const keys: Readonly<Record<string, TranslationKey>> = {
    "Items in the Trash are read-only": "konqueror.availability.itemsTrashReadOnly",
    "Finish the current operation first": "konqueror.availability.finishCurrentOperation",
    "No previous location": "konqueror.availability.noPreviousLocation",
    "No forward location": "konqueror.availability.noForwardLocation",
    "Already at Home": "konqueror.availability.alreadyHome",
    "Already at site root": "konqueror.availability.alreadySiteRoot",
    "Already at Start Page": "konqueror.availability.alreadyStartPage",
    "No file operation is available to undo": "konqueror.availability.noUndo",
    "Undo the last file operation": "konqueror.availability.undoLast",
    "Print is unavailable for this content": "konqueror.availability.printUnavailable",
    "Select a file or folder first": "konqueror.availability.selectFileOrFolder",
    "Select exactly one file or folder": "konqueror.availability.selectExactlyOneFileOrFolder",
    "Select exactly one file or folder before renaming": "konqueror.availability.selectExactlyOneBeforeRenaming",
    "Select a file or folder before renaming": "konqueror.availability.selectBeforeRenaming",
    "Open a folder before creating a new item": "konqueror.availability.openFolderBeforeCreate",
    "Open a folder before pasting": "konqueror.availability.openFolderBeforePaste",
    "Copy or cut an item before pasting": "konqueror.availability.copyBeforePaste",
    "System folders cannot be moved": "konqueror.availability.systemFoldersCannotMove",
    "System folders cannot be moved to the Trash": "konqueror.availability.systemFoldersCannotTrash",
    "Items cannot be pasted into the Trash": "konqueror.availability.itemsCannotPasteTrash",
    "Copy or move selected files": "konqueror.availability.copyOrMoveSelected",
    "Select one or more files or folders first": "konqueror.availability.selectItemsForTransfer",
    "The selected items cannot be copied or moved": "konqueror.availability.itemsCannotTransfer",
    "Open Terminal is available only for an ordinary filesystem directory": "konqueror.availability.openTerminalDirectory",
    "The current tab has no bookmarkable location": "konqueror.availability.noBookmarkableLocation",
    "No bookmarkable tabs are available": "konqueror.availability.noBookmarkableTabs",
    "Save or discard changes before using file operations": "konqueror.availability.saveDiscardBeforeOperations",
    "Edit Text File": "konqueror.availability.editTextFile",
    "Already editing this text file": "konqueror.availability.alreadyEditingTextFile",
    "Open a text file before editing": "konqueror.availability.openTextFileBeforeEditing",
    "No changes to save": "konqueror.availability.noChangesToSave",
    "Edit a text file before saving": "konqueror.availability.editBeforeSaving",
    "Discard Changes": "konqueror.availability.discardChanges",
    "Edit a text file before discarding changes": "konqueror.availability.editBeforeDiscarding",
    "Copy current file to another location": "konqueror.availability.copyCurrentFileTo",
    "Move current file to another location": "konqueror.availability.moveCurrentFileTo",
    "Copy clicked file to another location": "konqueror.availability.copyClickedFileTo",
    "Move clicked file to another location": "konqueror.availability.moveClickedFileTo",
    "Copy current folder to another location": "konqueror.availability.copyCurrentFolderTo",
    "Move current folder to another location": "konqueror.availability.moveCurrentFolderTo",
    "Create New Folder": "konqueror.availability.createNewFolder",
    "Create New Text File": "konqueror.availability.createNewTextFile",
    "Cut is unavailable for this content": "konqueror.availability.cutUnavailable",
    "Copy is unavailable for this content": "konqueror.availability.copyUnavailable",
    "Paste is unavailable for this content": "konqueror.availability.pasteUnavailable",
    "Save or discard changes before opening the requested location.": "konqueror.availability.saveDiscardBeforeNavigation",
    "Finish or cancel the current operation before opening the requested location.": "konqueror.availability.finishBeforeNavigation",
    "Back": "konqueror.menu.back",
    "Forward": "konqueror.menu.forward",
    "Up": "konqueror.menu.up",
    "Home": "konqueror.menu.home",
    "Open": "konqueror.context.open",
    "Properties": "konqueror.menu.properties",
    "Rename": "konqueror.menu.rename",
    "Copy Files": "konqueror.menu.copyFiles",
    "Move Files": "konqueror.menu.moveFiles",
    "Add Bookmark": "konqueror.menu.addBookmark",
    "New Bookmark Folder": "konqueror.menu.newBookmarkFolder",
    "Bookmark Tabs as Folder": "konqueror.menu.bookmarkTabs",
    "Open Terminal": "konqueror.menu.openTerminal",
    "Restore": "konqueror.context.restore",
    "Delete Permanently": "konqueror.context.permanentDelete",
    "Empty Trash": "konqueror.context.emptyTrash",
    "Move to Trash": "konqueror.menu.moveToTrash",
    "Cut": "konqueror.menu.cut",
    "Copy": "konqueror.menu.copy",
    "Paste": "konqueror.menu.paste",
  };
  const key = keys[text];
  return key === undefined ? text : t(key);
}

export function translateKonquerorNodeTypeLabel(t: Translator, label: string): string {
  switch (label) {
    case "Directory": return t("konqueror.view.directory");
    case "Link": return t("konqueror.view.link");
    case "Broken Link": return t("konqueror.view.brokenLink");
    case "Text Document": return t("konqueror.view.textDocument");
    default: return label;
  }
}

export function translateKonquerorApplicationMenuEntries(
  t: Translator,
  entries: readonly KonquerorApplicationMenuEntry[],
): readonly KonquerorApplicationMenuEntry[] {
  return entries.map((entry) => {
    if (entry.kind === "separator") return entry;
    if (entry.kind === "submenu") {
      const label = translateLabel(t, entry.label, applicationSubmenuKeys[entry.id]);
      return {
        ...entry,
        label,
        title: translateMenuTitle(t, entry.title, applicationSubmenuKeys[entry.id]),
        items: translateKonquerorApplicationMenuEntries(t, entry.items),
      } satisfies KonquerorApplicationMenuSubmenuEntry;
    }
    const key = applicationActionKeys[entry.action];
    const label = translateLabel(t, entry.label, entry.action === "open-bookmark" ? undefined : key);
    return {
      ...entry,
      label,
      title: translateMenuTitle(t, entry.title, entry.action === "open-bookmark" ? undefined : key),
    };
  });
}

export function translateKonquerorContextMenuEntries(
  t: Translator,
  entries: readonly KonquerorContextMenuEntry[],
): readonly KonquerorContextMenuEntry[] {
  return entries.map((entry) => {
    if (entry.kind === "separator") return entry;
    if (entry.kind === "submenu") {
      const key = contextSubmenuKeys[entry.id];
      return {
        ...entry,
        label: translateLabel(t, entry.label, key),
        title: translateMenuTitle(t, entry.title, key),
        items: entry.items.map((item) => {
          if (item.kind === "separator") return item;
          const itemKey = item.action === "paste" && item.label !== "Paste Clipboard Contents"
            ? undefined
            : entry.id === "create-new" && item.action === "new-folder"
            ? "konqueror.menu.folder"
            : contextActionKeys[item.action];
          return { ...item, label: translateLabel(t, item.label, itemKey), title: translateMenuTitle(t, item.title, itemKey) };
        }),
      };
    }
    const key = entry.action === "paste" && entry.label !== "Paste Clipboard Contents"
      ? undefined
      : contextActionKeys[entry.action];
    return { ...entry, label: translateLabel(t, entry.label, key), title: translateMenuTitle(t, entry.title, key) };
  });
}
