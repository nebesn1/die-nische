import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "../../application-runtime/applicationRegistry";
import {
  createKonquerorBookmark,
  createKonquerorBookmarkFolder,
} from "../../apps/konqueror/bookmarks";
import { createInitialVfsState } from "../../vfs/initialState";
import { PROJECT_ABOUT_ICON_ID } from "../../branding/projectIdentity";
import {
  findKMenuEntry,
  flattenKMenuEntries,
  getKMenuEntries,
  getMostUsedEligibleApplicationIds,
  isEnabledApplicationRegistered,
  kMenuEntries,
} from "./menuModel";
import type { KMenuApplicationEntry, KMenuEntry, KMenuSubmenuEntry } from "./types";

const getEntryLabels = (entries: readonly KMenuEntry[]) =>
  entries.filter((entry) => entry.type !== "separator").map((entry) => entry.label);

const isEnabledApplication = (entry: KMenuEntry): entry is KMenuApplicationEntry =>
  entry.type === "application" && entry.enabled;

const getSubmenu = (id: string, entries?: readonly KMenuEntry[]): KMenuSubmenuEntry => {
  const entry = findKMenuEntry(id, entries);

  if (!entry || entry.type !== "submenu") {
    throw new Error(`Expected ${id} to be a submenu.`);
  }

  return entry;
};

describe("kMenuEntries", () => {
  it("uses the exact KDE 3.3 top-level K Menu order", () => {
    expect(getEntryLabels(kMenuEntries)).toEqual([
      "Most Used Applications",
      "All Applications",
      "Editors",
      "Internet",
      "Settings",
      "System",
      "Utilities",
      "Control Center",
      "Find Files",
      "Help",
      "About die Nische",
      "Personal Files (Home)",
      "Actions",
      "Bookmarks",
      "Quick Browser",
      "Run Command...",
      "Lock Session",
      "Logout...",
    ]);
  });

  it("does not retain the retired modern top-level categories or direct Configure Panel row", () => {
    const labels = getEntryLabels(kMenuEntries);

    ["Development", "Edutainment", "Games", "Graphics", "Multimedia", "Office", "Configure Panel"].forEach((label) => {
      expect(labels).not.toContain(label);
    });
  });

  it("uses non-interactive section entries and stable unique identities", () => {
    expect(kMenuEntries.filter((entry) => entry.type === "section").map((entry) => entry.id)).toEqual([
      "section-most-used",
      "section-all-applications",
      "section-actions",
    ]);

    const ids = flattenKMenuEntries().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps only implemented applications into the KDE category submenus", () => {
    expect(getSubmenu("category-editors")).toMatchObject({ enabled: true });
    expect(getEntryLabels(getSubmenu("category-editors").children)).toEqual(["Text Editor (KWrite)"]);
    expect(getEntryLabels(getSubmenu("category-internet").children)).toEqual(["Web Browser (Konqueror)"]);
    expect(getEntryLabels(getSubmenu("category-settings").children)).toEqual(["Configure the Panel"]);
    expect(getEntryLabels(getSubmenu("category-system").children)).toEqual(["Terminal Program (Konsole)"]);
    expect(getEntryLabels(getSubmenu("category-utilities").children)).toEqual(["Scientific Calculator (KCalc)"]);
  });

  it("projects runtime Most Used application identities above All Applications", () => {
    const entries = getKMenuEntries(["kwrite", "kcalc", "kcontrol"]);

    expect(getEntryLabels(entries).slice(0, 5)).toEqual([
      "Most Used Applications",
      "Text Editor (KWrite)",
      "Scientific Calculator (KCalc)",
      "Control Center",
      "All Applications",
    ]);
    expect(findKMenuEntry("most-used-kwrite", entries)).toMatchObject({ type: "application", appId: "kwrite" });
    expect(findKMenuEntry("most-used-kcontrol", entries)).toMatchObject({ type: "application", appId: "kcontrol" });
  });

  it("disables only the mobile-unsupported entries by stable application/action identities", () => {
    const desktop = getKMenuEntries(["configure-panel", "kcalc", "kfind"], [], null, "desktop");
    const mobile = getKMenuEntries(["configure-panel", "kcalc", "kfind"], [], null, "mobile");
    const unsupportedIds = [
      "settings-configure-panel",
      "app-kcalc",
      "common-find-files",
      "action-bookmarks",
      "action-quick-browser",
      "command-run",
      "most-used-configure-panel",
      "most-used-kcalc",
      "most-used-kfind",
    ];

    unsupportedIds.forEach((id) => {
      expect(findKMenuEntry(id, mobile)).toMatchObject({ enabled: false });
      expect(findKMenuEntry(id, desktop)).toMatchObject({ enabled: true });
    });

    expect(findKMenuEntry("common-home", mobile)).toMatchObject({ enabled: true });
    expect(findKMenuEntry("command-lock-screen", mobile)).toMatchObject({ enabled: true });
  });

  it("uses the same K Menu presentation labels for category and Most Used application rows", () => {
    const entries = getKMenuEntries(["kwrite", "konqueror", "konsole", "kcalc"]);

    [
      ["app-kwrite", "most-used-kwrite", "Text Editor (KWrite)"],
      ["app-konqueror-browser", "most-used-konqueror", "Web Browser (Konqueror)"],
      ["app-konsole", "most-used-konsole", "Terminal Program (Konsole)"],
      ["app-kcalc", "most-used-kcalc", "Scientific Calculator (KCalc)"],
    ].forEach(([categoryId, mostUsedId, label]) => {
      expect(findKMenuEntry(categoryId, entries)).toMatchObject({ appId: expect.any(String), label });
      expect(findKMenuEntry(mostUsedId, entries)).toMatchObject({ appId: expect.any(String), label });
    });
  });

  it("assigns distinct semantic presentation icons to K Menu feature entries", () => {
    const requiredIconIds = [
      ["category-settings", "kmenu-settings"],
      ["category-system", "kmenu-system"],
      ["category-utilities", "kmenu-utilities"],
      ["all-applications-control-center", "kmenu-control-center"],
      ["common-find-files", "kmenu-find-files"],
      ["common-help", "kmenu-help"],
      ["common-project-about", PROJECT_ABOUT_ICON_ID],
      ["command-logout", "kmenu-logout"],
      ["category-internet", "internet"],
      ["action-quick-browser", "kmenu-quick-browser"],
    ] as const;
    const getIconId = (entryId: string): string => {
      const entry = findKMenuEntry(entryId);
      if (!entry || entry.type === "section" || entry.type === "separator") {
        throw new Error(`Expected an executable K Menu entry for ${entryId}.`);
      }

      return entry.iconId;
    };

    expect(requiredIconIds.map(([entryId]) => getIconId(entryId))).toEqual(
      requiredIconIds.map(([, iconId]) => iconId),
    );
    expect(new Set(requiredIconIds.map(([, iconId]) => iconId)).size).toBe(requiredIconIds.length);
    expect(findKMenuEntry("most-used-kcontrol", getKMenuEntries(["kcontrol"]))).toMatchObject({
      type: "application",
      appId: "kcontrol",
      iconId: "kmenu-control-center",
    });
  });

  it("derives Most Used eligibility from implemented Phase 5.88 application entries", () => {
    expect(getMostUsedEligibleApplicationIds()).toEqual([
      "kwrite",
      "konqueror",
      "configure-panel",
      "konsole",
      "kcalc",
      "kcontrol",
      "kfind",
      "about-kde",
    ]);
  });

  it("keeps Find Files, Help, and Personal Files mapped to existing launchers", () => {
    expect(findKMenuEntry("common-find-files")).toMatchObject({ type: "application", appId: "kfind", newInstance: true });
    expect(findKMenuEntry("common-help")).toMatchObject({ type: "application", appId: "about-kde" });
    expect(findKMenuEntry("common-project-about")).toMatchObject({
      type: "application",
      appId: "about-die-nische",
      label: "About die Nische",
      iconId: PROJECT_ABOUT_ICON_ID,
    });
    expect(findKMenuEntry("common-home")).toMatchObject({
      type: "application",
      appId: "konqueror",
      newInstance: true,
      launchIntent: { type: "open-special-location", location: "home" },
    });
  });

  it("enables the implemented action targets with runtime-owned submenu content", () => {
    expect(findKMenuEntry("action-bookmarks")).toMatchObject({ type: "submenu", enabled: true, children: [] });
    expect(findKMenuEntry("action-quick-browser")).toMatchObject({ type: "submenu", enabled: true, children: [] });
    ["command-run", "command-lock-screen", "command-logout"].forEach((id) => {
      expect(findKMenuEntry(id)).toMatchObject({ type: "command", enabled: true });
    });
  });

  it("derives recursive Bookmark entries in stored mixed order with stable command payloads", () => {
    const bookmarkA = createKonquerorBookmark({ name: "Alpha", location: "/home/user" }, "bookmark-a");
    const nestedBookmark = createKonquerorBookmark({ name: "Nested", location: "https://example.com" }, "bookmark-nested");
    const folder = createKonquerorBookmarkFolder({ name: "Work" }, "folder-work", [nestedBookmark]);
    const bookmarkB = createKonquerorBookmark({ name: "Bravo", location: "/home/user/Documents" }, "bookmark-b");
    const entries = getKMenuEntries([], [bookmarkA, folder, bookmarkB], createInitialVfsState());
    const bookmarks = getSubmenu("action-bookmarks", entries);

    expect(bookmarks.children.map((entry) => entry.type === "separator" ? "separator" : entry.label)).toEqual([
      "Alpha",
      "Work",
      "Bravo",
      "separator",
      "Edit Bookmarks...",
    ]);
    expect(findKMenuEntry("bookmark-bookmark-a", entries)).toMatchObject({
      type: "command",
      commandId: "open-bookmark",
      payload: { bookmarkId: "bookmark-a", location: "/home/user" },
    });
    expect(getSubmenu("bookmark-folder-folder-work", entries).children).toMatchObject([
      { type: "command", label: "Nested", commandId: "open-bookmark", payload: { bookmarkId: "bookmark-nested" } },
    ]);
  });

  it("derives only the supported Quick Browser roots from the live VFS", () => {
    const entries = getKMenuEntries([], [], createInitialVfsState());
    const quickBrowser = getSubmenu("action-quick-browser", entries);

    expect(quickBrowser.children.map((entry) => entry.type === "separator" ? "separator" : entry.label)).toEqual([
      "Home Directory",
      "Root Directory",
    ]);
    expect(quickBrowser.children[0]).toMatchObject({ type: "submenu", enabled: true });
    expect(quickBrowser.children[1]).toMatchObject({ type: "submenu", enabled: true });
    expect(quickBrowser.children).not.toContainEqual(expect.objectContaining({ label: "System Configuration" }));
    expect(getSubmenu("quick-root-/home/user", entries).children.slice(0, 3)).toMatchObject([
      { label: "Open in File Manager", commandId: "open-location", payload: { location: "/home/user" } },
      { label: "Open in Terminal", commandId: "open-terminal-directory", payload: { location: "/home/user" } },
      { type: "separator" },
    ]);
    expect(getSubmenu("quick-root-/home/user", entries).children.slice(3).map((entry) => entry.type === "separator" ? "separator" : entry.label)).toEqual([
      "Desktop",
      "Documents",
      "Downloads",
      "Music",
      "Pictures",
      "Videos",
      ".local",
    ]);
  });

  it("keeps Quick Browser submenu content tied to each directory node id", () => {
    const entries = getKMenuEntries([], [], createInitialVfsState());
    const root = getSubmenu("quick-root-/", entries);
    const home = root.children.find((entry): entry is KMenuSubmenuEntry => entry.type === "submenu" && entry.label === "home");
    if (!home) throw new Error("Quick Browser home directory is missing.");

    const user = home.children.find((entry): entry is KMenuSubmenuEntry => entry.type === "submenu" && entry.label === "user");
    if (!user) throw new Error("Quick Browser user directory is missing.");

    expect(home.id).toBe("quick-directory-root:vfs-root:vfs-home");
    expect(user.id).toBe("quick-directory-root:vfs-root:vfs-home:vfs-user");
    expect(user.children.map((entry) => entry.type === "separator" ? "separator" : entry.label)).toEqual([
      "Open in File Manager",
      "Open in Terminal",
      "separator",
      "Desktop",
      "Documents",
      "Downloads",
      "Music",
      "Pictures",
      "Videos",
      ".local",
    ]);
    const homeShortcut = getSubmenu("quick-root-/home/user", entries);
    expect(homeShortcut.children[0]).toMatchObject({ id: "quick-open-home:vfs-user", payload: { location: "/home/user" } });
    expect(user.children[0]).toMatchObject({ id: "quick-open-root:vfs-root:vfs-home:vfs-user", payload: { location: "/home/user" } });
    expect(homeShortcut.children[0]?.id).not.toBe(user.children[0]?.id);
    expect(new Set([root.id, home.id, user.id]).size).toBe(3);
  });

  it("keeps every enabled application linked to the application registry", () => {
    const enabledApplications = flattenKMenuEntries().filter(isEnabledApplication);

    enabledApplications.forEach((entry) => {
      expect(getApplicationDefinition(entry.appId)).toBeDefined();
      expect(isEnabledApplicationRegistered(entry)).toBe(true);
    });
  });

  it("freezes the menu model and nested submenus", () => {
    const internet = findKMenuEntry("category-internet");

    expect(Object.isFrozen(kMenuEntries)).toBe(true);
    expect(Object.isFrozen(internet)).toBe(true);
    expect(internet?.type === "submenu" ? Object.isFrozen(internet.children) : false).toBe(true);
  });
});
