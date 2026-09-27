import { readFileSync } from "node:fs";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonquerorApplicationMenu } from "./KonquerorApplicationMenu";
import type { KonquerorApplicationMenuEntry } from "./applicationMenuModel";

const entries: readonly KonquerorApplicationMenuEntry[] = [
  { kind: "action", action: "view-tree", label: "Tree View", enabled: true, title: "Tree View", checked: true, checkKind: "radio" },
  { kind: "action", action: "add-bookmark", label: "Add Bookmark", enabled: true, title: "Add Bookmark", shortcut: "Ctrl+B" },
  { kind: "separator" },
  { kind: "action", action: "paste", label: "Paste", enabled: false, title: "Copy first" },
];

describe("KonquerorApplicationMenu", () => {
  it("renders the final KDE-style Location/Edit/View/Go/Bookmarks/Tools/Settings/Window/Help bar", () => {
    const markup = renderToStaticMarkup(
      <KonquerorApplicationMenu
        menuBarRef={createRef<HTMLElement>()}
        popupRef={createRef<HTMLDivElement>()}
        screenArea={{ x: 0, y: 0, width: 1024, height: 768 }}
        openMenu={{ menu: "view", requestId: 1 }}
        entries={entries}
        onToggleMenu={() => undefined}
        onAction={() => undefined}
        onEscape={() => undefined}
      />,
    );

    const labels = [...markup.matchAll(/class="konqueror-menuitem[^>]*>([^<]+)</g)].map((match) => match[1]);

    expect(labels).toEqual(["Location", "Edit", "View", "Go", "Bookmarks", "Tools", "Settings", "Window", "Help"]);
    expect(markup).not.toContain(">File<");
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('role="menu"');
    expect(markup).toContain('role="menuitemradio"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('role="separator"');
    expect(markup).toContain("disabled=\"\"");
    expect(markup).toContain("Add Bookmark");
    expect(markup).toContain("Ctrl+B");
  });

  it("keeps command execution in the parent controller and owns nested menu positioning without VFS mutations", () => {
    const source = readFileSync(new URL("./KonquerorApplicationMenu.tsx", import.meta.url), "utf8");

    expect(source).toContain("onAction(entry.action, entry.parentFolderId, entry.bookmarkId)");
    expect(source).toContain("onEscape()");
    expect(source).toContain("triggerRefs.current[request.menu]");
    expect(source).toContain("getKonquerorApplicationMenuPopupPosition");
    expect(source).toContain("getKonquerorSubmenuPosition");
    expect(source).toContain("useMeasuredPopupPosition");
    expect(source).toContain("useLayoutEffect");
    expect(source).toContain("konquerorApplicationMenuSubmenuReducer");
    expect(source).toContain("KonquerorApplicationMenuSubmenu key={item.id}");
    expect(source).toContain('visibility: "hidden", pointerEvents: "none"');
    expect(source).not.toContain("useApplicationMenuDismissal");
    expect(source).not.toContain("document.addEventListener");
    expect(source).not.toContain("window.addEventListener");
    expect(source).not.toContain("createVfs");
    expect(source).not.toContain("renameVfs");
    expect(source).not.toContain("moveVfs");
    expect(source).toContain("WindowOwnedPopupPortal");
  });

  it("inserts Player only when the active view is media, between Bookmarks and Tools", () => {
    const markup = renderToStaticMarkup(
      <KonquerorApplicationMenu
        menuBarRef={createRef<HTMLElement>()}
        popupRef={createRef<HTMLDivElement>()}
        screenArea={{ x: 0, y: 0, width: 1024, height: 768 }}
        openMenu={{ menu: "player", requestId: 2 }}
        entries={entries}
        showPlayerMenu
        onToggleMenu={() => undefined}
        onAction={() => undefined}
        onEscape={() => undefined}
      />,
    );

    const labels = [...markup.matchAll(/class="konqueror-menuitem[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(labels).toEqual(["Location", "Edit", "View", "Go", "Bookmarks", "Player", "Tools", "Settings", "Window", "Help"]);
  });
});
