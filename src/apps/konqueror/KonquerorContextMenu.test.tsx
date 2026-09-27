import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { KonquerorContextMenu } from "./KonquerorContextMenu";
import type { KonquerorContextMenuEntry } from "./contextMenuModel";

const entries: readonly KonquerorContextMenuEntry[] = [
  {
    kind: "submenu",
    id: "preview-in",
    label: "Preview In",
    enabled: true,
    title: "Preview In",
    items: [
      { kind: "action", action: "preview-khtml", label: "KHTML", enabled: true, title: "KHTML", checked: true },
      { kind: "action", action: "preview-embedded-text", label: "Embedded Advanced Text Editor", enabled: true, title: "Embedded Advanced Text Editor" },
    ],
  },
  { kind: "separator" },
  {
    kind: "submenu",
    id: "actions",
    label: "Actions",
    enabled: true,
    title: "Actions",
    items: [
      { kind: "action", action: "open-terminal-here", label: "Open Terminal Here", enabled: true, title: "Open Terminal Here" },
    ],
  },
  { kind: "separator" },
  { kind: "action", action: "paste", label: "Paste", enabled: false, title: "Copy first" },
];

describe("KonquerorContextMenu", () => {
  it("renders compact menu buttons, separators, and native disabled actions", () => {
    const markup = renderToStaticMarkup(
      <KonquerorContextMenu
        menuState={{ kind: "item", requestId: 1, clickedNodeId: "vfs-content-e594a065214576326cb903a5", targetNodeIds: ["vfs-content-e594a065214576326cb903a5"], clientX: 48, clientY: 62 }}
        entries={entries}
        containerRef={createRef<HTMLDivElement>()}
        screenArea={{ x: 0, y: 0, width: 1024, height: 768 }}
        onDismiss={() => undefined}
        onAction={() => undefined}
      />,
    );

    expect(markup).toContain('role="menu"');
    expect(markup).toContain('role="menuitem"');
    expect(markup).toContain('role="separator"');
    expect(markup).toContain(">Preview In<");
    expect(markup).toContain(">Actions<");
    expect(markup).toContain("konqueror-context-menu__marker");
    expect(markup).toContain("konqueror-context-menu__label");
    expect(markup).toContain("konqueror-context-menu__submenu-arrow");
    expect(markup).toContain(">Paste<");
    expect(markup).toContain("disabled=\"\"");
    expect(markup).toContain("konqueror-context-menu");
    expect(markup).toContain("visibility:hidden");
    expect(markup).toContain("pointer-events:none");
    expect(markup).not.toContain("left:0");
  });

  it("does not render while closed and keeps dismissal local to the existing pointer hook", () => {
    expect(
      renderToStaticMarkup(
        <KonquerorContextMenu
          menuState={null}
          entries={entries}
          containerRef={createRef<HTMLDivElement>()}
          screenArea={{ x: 0, y: 0, width: 1024, height: 768 }}
          onDismiss={() => undefined}
          onAction={() => undefined}
        />,
      ),
    ).toBe("");

    const source = readFileSync(new URL("./KonquerorContextMenu.tsx", import.meta.url), "utf8");
    expect(source).toContain("useApplicationMenuDismissal");
    expect(source).toContain("getKonquerorPopupLocalPosition");
    expect(source).toContain("getKonquerorScreenAreaLocalBounds(screenArea, containerBounds)");
    expect(source).toContain("useMeasuredPopupPosition");
    expect(source).toContain('visibility: "hidden", pointerEvents: "none"');
    expect(source).toContain("KONQUEROR_SUBMENU_CLOSE_GRACE_MS");
    expect(source).toContain("clearPendingClose");
    expect(source).toContain("cancelSubmenuClose(entry.id)");
    expect(source).toContain("scheduleSubmenuClose(entry.id)");
    expect(source).not.toContain("document.addEventListener");
    expect(source).not.toContain("window.addEventListener");
    expect(source).toContain("onClick={() => entry.enabled && onAction()}");
    expect(source).not.toContain("preventDefault();\n                onAction");
    expect(source).not.toContain("moveVfsNode");
    expect(source).not.toContain("writeVfsTextFile");
    expect(source).not.toContain("document.addEventListener");
    expect(source).not.toContain("window.addEventListener");
  });

  it("uses a shared menu-row grid and content-sized nowrap submenus", () => {
    const css = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

    expect(css).toContain("grid-template-columns: 14px minmax(0, 1fr) max-content;");
    expect(css).toContain(".konqueror-context-menu__marker");
    expect(css).toContain("white-space: nowrap;");
    expect(css).toContain("width: max-content;");
    expect(css).not.toContain("konqueror-context-menu__check");
  });
});
