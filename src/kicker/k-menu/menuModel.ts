import { getApplicationDefinition, hasApplication, isApplicationMostUsedEligible } from "../../application-runtime/applicationRegistry";
import { createKonquerorOpenLocationIntent, createKonquerorOpenStartIntent } from "../../apps/konqueror/launchIntent";
import { isKonquerorBookmarkFolder, type KonquerorBookmarkNode } from "../../apps/konqueror/bookmarks";
import { PROJECT_ABOUT_ICON_ID } from "../../branding/projectIdentity";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { getVfsPathForNode, resolveVfsPath } from "../../vfs/queries";
import type { VfsNode, VfsState } from "../../vfs/types";
import type { WindowLayoutMode } from "../../window-manager/types";
import { applyKMenuAvailability } from "./mobileKMenuAvailability";
import type { KMenuApplicationEntry, KMenuEntry } from "./types";

const application = (
  id: string,
  label: string,
  iconId: string,
  appId: string,
  options: Readonly<{ newInstance?: boolean; launchIntent?: unknown }> = {},
): KMenuEntry => ({
  type: "application",
  id,
  label,
  iconId,
  appId,
  enabled: hasApplication(appId),
  ...options,
});

const command = (
  id: string,
  label: string,
  iconId: string,
  commandId: string,
  enabled = true,
  payload?: unknown,
): KMenuEntry => ({
  type: "command",
  id,
  label,
  iconId,
  commandId,
  enabled,
  ...(payload === undefined ? {} : { payload }),
});

const freezeEntries = <T extends readonly KMenuEntry[]>(entries: T): T => {
  entries.forEach((entry) => {
    if (entry.type === "submenu") {
      freezeEntries(entry.children);
    }

    if (entry.type === "application" && typeof entry.launchIntent === "object" && entry.launchIntent !== null) {
      Object.freeze(entry.launchIntent);
    }

    Object.freeze(entry);
  });

  return Object.freeze(entries);
};

/**
 * The Kicker-local presentation follows the KDE 3.3 K Menu hierarchy. It maps
 * only registered applications and keeps unavailable historical functions visible.
 */
export const kMenuEntries = freezeEntries([
  { type: "section", id: "section-most-used", label: "Most Used Applications" },
  { type: "section", id: "section-all-applications", label: "All Applications" },
  {
    type: "submenu",
    id: "category-editors",
    label: "Editors",
    iconId: "editors",
    enabled: hasApplication("kwrite"),
    children: [application("app-kwrite", "Text Editor (KWrite)", "kwrite", "kwrite", { newInstance: true })],
  },
  {
    type: "submenu",
    id: "category-internet",
    label: "Internet",
    iconId: "internet",
    enabled: hasApplication("konqueror"),
    children: [application("app-konqueror-browser", "Web Browser (Konqueror)", "konqueror", "konqueror", {
      newInstance: true,
      launchIntent: createKonquerorOpenStartIntent(),
    })],
  },
  {
    type: "submenu",
    id: "category-settings",
    label: "Settings",
    iconId: "kmenu-settings",
    enabled: hasApplication("kcontrol"),
    children: [
      application("settings-configure-panel", "Configure the Panel", "panel-settings", "configure-panel"),
    ],
  },
  {
    type: "submenu",
    id: "category-system",
    label: "System",
    iconId: "kmenu-system",
    enabled: hasApplication("konsole"),
    children: [application("app-konsole", "Terminal Program (Konsole)", "konsole", "konsole", { newInstance: true })],
  },
  {
    type: "submenu",
    id: "category-utilities",
    label: "Utilities",
    iconId: "kmenu-utilities",
    enabled: hasApplication("kcalc"),
    children: [application("app-kcalc", "Scientific Calculator (KCalc)", "kcalc", "kcalc", { newInstance: true })],
  },
  application("all-applications-control-center", "Control Center", "kmenu-control-center", "kcontrol"),
  application("common-find-files", "Find Files", "kmenu-find-files", "kfind", { newInstance: true }),
  application("common-help", "Help", "kmenu-help", "about-kde"),
  application("common-project-about", "About die Nische", PROJECT_ABOUT_ICON_ID, "about-die-nische"),
  application("common-home", "Personal Files (Home)", "home", "konqueror", {
    newInstance: true,
    launchIntent: createKonquerorOpenLocationIntent("home"),
  }),
  { type: "section", id: "section-actions", label: "Actions" },
  {
    type: "submenu",
    id: "action-bookmarks",
    label: "Bookmarks",
    iconId: "bookmark",
    enabled: true,
    children: [],
  },
  {
    type: "submenu",
    id: "action-quick-browser",
    label: "Quick Browser",
    iconId: "kmenu-quick-browser",
    enabled: true,
    children: [],
  },
  command("command-run", "Run Command...", "run-command", "run-command"),
  command("command-lock-screen", "Lock Session", "lock-screen", "lock-session"),
  command("command-logout", "Logout...", "kmenu-logout", "logout"),
] as const satisfies readonly KMenuEntry[]);

const separator = (id: string): KMenuEntry => ({ type: "separator", id });

const getBookmarkEntries = (
  nodes: readonly KonquerorBookmarkNode[],
  includeEditorAction = true,
): readonly KMenuEntry[] => {
  const editorActions: readonly KMenuEntry[] = includeEditorAction
    ? [separator("bookmark-tree-separator"), command("bookmark-edit", "Edit Bookmarks...", "editors", "edit-bookmarks")]
    : [];

  if (nodes.length === 0) {
    return [
      command("bookmark-empty", "(No Bookmarks)", "bookmark", "no-bookmarks", false),
      ...editorActions,
    ];
  }

  return [
    ...nodes.map((node): KMenuEntry => isKonquerorBookmarkFolder(node)
      ? {
        type: "submenu",
        id: `bookmark-folder-${node.id}`,
        label: node.name,
        iconId: "bookmark",
        enabled: true,
        children: getBookmarkEntries(node.children, false),
      }
      : command(`bookmark-${node.id}`, node.name, "bookmark", "open-bookmark", true, { bookmarkId: node.id, location: node.location }),
    ),
    ...editorActions,
  ];
};

const getQuickBrowserNodeEntry = (vfsState: VfsState, node: VfsNode, occurrencePrefix: string): KMenuEntry => {
  const path = getVfsPathForNode(vfsState, node.id);
  const label = getVfsNodeDisplayName(node);
  const occurrenceKey = `${occurrencePrefix}:${node.id}`;

  if (!path.ok) {
    return command(`quick-node-${occurrenceKey}`, label, "konqueror", "open-location", false);
  }

  if (node.kind !== "directory") {
    return command(`quick-node-${occurrenceKey}`, label, "konqueror", "open-location", true, { location: path.value });
  }

  const children = node.childIds
    .map((childId) => vfsState.nodesById[childId])
    .filter((child): child is VfsNode => child !== undefined)
    .map((child) => getQuickBrowserNodeEntry(vfsState, child, occurrenceKey));
  const directoryActions: readonly KMenuEntry[] = [
    command(`quick-open-${occurrenceKey}`, "Open in File Manager", "konqueror", "open-location", true, { location: path.value }),
    command(`quick-terminal-${occurrenceKey}`, "Open in Terminal", "run-command", "open-terminal-directory", true, { location: path.value }),
  ];

  return {
    type: "submenu",
    id: `quick-directory-${occurrenceKey}`,
    label,
    iconId: "konqueror",
    enabled: true,
    children: [
      ...directoryActions,
      separator(`quick-separator-${occurrenceKey}`),
      ...(children.length > 0 ? children : [command(`quick-empty-${occurrenceKey}`, "(Empty)", "konqueror", "empty-directory", false)]),
    ],
  };
};

const getQuickBrowserEntries = (vfsState: VfsState | null): readonly KMenuEntry[] => {
  if (vfsState === null) {
    return [];
  }

  return ["/home/user", "/"].map((path) => {
    const resolved = resolveVfsPath(vfsState, path);
    const label = path === "/home/user" ? "Home Directory" : "Root Directory";
    if (!resolved.ok || resolved.value.kind !== "directory") {
      return command(`quick-root-${path}`, label, "konqueror", "open-location", false);
    }

    const occurrencePrefix = path === "/home/user" ? "home" : "root";
    const entry = getQuickBrowserNodeEntry(vfsState, resolved.value, occurrencePrefix);
    return { ...entry, id: `quick-root-${path}`, label } as KMenuEntry;
  });
};

const getMostUsedTemplate = (appId: string): KMenuApplicationEntry | undefined =>
  flattenKMenuEntries(kMenuEntries).find(
    (entry): entry is KMenuApplicationEntry => entry.type === "application" && entry.enabled && entry.appId === appId,
  );

export function getMostUsedEligibleApplicationIds(): readonly string[] {
  return [...new Set(
    flattenKMenuEntries(kMenuEntries)
      .filter((entry): entry is KMenuApplicationEntry => entry.type === "application" && entry.enabled && isApplicationMostUsedEligible(entry.appId))
      .map((entry) => entry.appId),
  )];
}

/** Builds the runtime-only Most Used rows without adding another ordering authority. */
export function getKMenuEntries(
  mostUsedApplicationIds: readonly string[] = [],
  bookmarkRootChildren: readonly KonquerorBookmarkNode[] = [],
  vfsState: VfsState | null = null,
  layoutMode: WindowLayoutMode = "desktop",
): readonly KMenuEntry[] {
  const mostUsedEntries = mostUsedApplicationIds.flatMap((appId) => {
    const template = getMostUsedTemplate(appId);

    return template === undefined
      ? []
      : [{ ...template, id: `most-used-${appId}` } satisfies KMenuApplicationEntry];
  });

  const staticEntries = kMenuEntries.map((entry): KMenuEntry => {
    if (entry.type === "submenu" && entry.id === "action-bookmarks") {
      return { ...entry, children: getBookmarkEntries(bookmarkRootChildren) };
    }
    if (entry.type === "submenu" && entry.id === "action-quick-browser") {
      return { ...entry, children: getQuickBrowserEntries(vfsState) };
    }
    return entry;
  });

  return freezeEntries(applyKMenuAvailability([
    staticEntries[0]!,
    ...mostUsedEntries,
    ...staticEntries.slice(1),
  ], layoutMode));
}

export function flattenKMenuEntries(entries: readonly KMenuEntry[] = kMenuEntries): readonly KMenuEntry[] {
  return entries.flatMap((entry) => (entry.type === "submenu" ? [entry, ...flattenKMenuEntries(entry.children)] : [entry]));
}

export function findKMenuEntry(entryId: string, entries: readonly KMenuEntry[] = kMenuEntries): KMenuEntry | undefined {
  for (const entry of entries) {
    if (entry.id === entryId) {
      return entry;
    }

    if (entry.type === "submenu") {
      const child = findKMenuEntry(entryId, entry.children);
      if (child) return child;
    }
  }

  return undefined;
}

export function isEnabledApplicationRegistered(entry: KMenuEntry): boolean {
  return entry.type !== "application" || !entry.enabled || getApplicationDefinition(entry.appId) !== undefined;
}
