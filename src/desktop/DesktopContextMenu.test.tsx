import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DesktopContextMenu } from "./DesktopContextMenu";

const screenArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 686,
};

describe("DesktopContextMenu", () => {
  it("renders the compact desktop-only menu with separators and semantic menu controls", () => {
    const markup = renderToStaticMarkup(
      <DesktopContextMenu
        menuState={{ kind: "background", requestId: 1, desktopId: 1, clientX: 320, clientY: 240 }}
        containerRef={createRef<HTMLElement>()}
        screenArea={screenArea}
        canEmptyTrash={false}
        onDismiss={() => undefined}
        onAction={() => undefined}
      />,
    );

    expect(markup).toContain("class=\"desktop-context-menu\"");
    expect(markup).toContain("k-context-menu-separator");
    expect(markup).toContain("role=\"menu\"");
    expect(markup.match(/role="menuitem"/g)).toHaveLength(4);
    expect(markup.match(/role="separator"/g)).toHaveLength(2);
    expect(markup).toContain("Run Command...");
    expect(markup).toContain("Configure Desktop...");
    expect(markup).toContain("Lock Session");
    expect(markup).toContain('Log Out &quot;user&quot;...');
    expect(markup).not.toContain("Open Home");
    expect(markup).not.toContain("Find Files/Folders");
    expect(markup).not.toContain("Open Terminal");
    expect(markup).not.toContain("About KDE");
    expect(markup).toContain("visibility:hidden");
    expect(markup).toContain("pointer-events:none");
    expect(markup).not.toContain("left:0");
  });

  it("does not render while closed", () => {
    const markup = renderToStaticMarkup(
      <DesktopContextMenu
        menuState={null}
        containerRef={createRef<HTMLElement>()}
        screenArea={screenArea}
        canEmptyTrash={false}
        onDismiss={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(markup).toBe("");
  });

  it("renders the icon-specific menus with stable target actions", () => {
    const computer = renderToStaticMarkup(
      <DesktopContextMenu
        menuState={{ kind: "icon", requestId: 1, desktopId: 1, iconId: "desktop-my-computer", clientX: 320, clientY: 240 }}
        containerRef={createRef<HTMLElement>()}
        screenArea={screenArea}
        canEmptyTrash={false}
        onDismiss={() => undefined}
        onAction={() => undefined}
      />,
    );
    const trash = renderToStaticMarkup(
      <DesktopContextMenu
        menuState={{ kind: "icon", requestId: 1, desktopId: 1, iconId: "desktop-trash", clientX: 320, clientY: 240 }}
        containerRef={createRef<HTMLElement>()}
        screenArea={screenArea}
        canEmptyTrash={false}
        onDismiss={() => undefined}
        onAction={() => undefined}
      />,
    );
    const blog = renderToStaticMarkup(
      <DesktopContextMenu
        menuState={{ kind: "icon", requestId: 1, desktopId: 1, iconId: "desktop-blog", clientX: 320, clientY: 240 }}
        containerRef={createRef<HTMLElement>()}
        screenArea={screenArea}
        canEmptyTrash={false}
        onDismiss={() => undefined}
        onAction={() => undefined}
      />,
    );

    expect(computer.match(/role="menuitem"/g)).toHaveLength(1);
    expect(computer).toContain("Open");
    expect(computer).not.toContain("Empty Trash");
    expect(trash).toContain("Empty Trash");
    expect(trash).toContain("disabled");
    expect(blog.match(/role="menuitem"/g)).toHaveLength(1);
    expect(blog).toContain("Open");
    expect(blog).not.toContain("Empty Trash");
  });

  it("uses the shared pre-paint measured position lifecycle instead of a post-paint correction", () => {
    const source = readFileSync(new URL("./DesktopContextMenu.tsx", import.meta.url), "utf8");

    expect(source).toContain("useMeasuredPopupPosition");
    expect(source).toContain("useLayoutEffect");
    expect(source).not.toContain("useEffect(() => {");
    expect(source).toContain('visibility: "hidden", pointerEvents: "none"');
  });
});
