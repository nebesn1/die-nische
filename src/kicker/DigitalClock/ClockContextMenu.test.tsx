import { readFileSync } from "node:fs";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClockContextMenu } from "./ClockContextMenu";

describe("Clock context menu", () => {
  it("contains only Configure Clock and uses the existing KDE menu surface", () => {
    const markup = renderToStaticMarkup(
      <ClockContextMenu
        menuState={{ requestId: 1, clientX: 40, clientY: 60 }}
        clockRef={createRef<HTMLElement>()}
        screenArea={{ x: 0, y: 0, width: 1024, height: 768 }}
        onDismiss={() => undefined}
        onLaunchApplication={() => undefined}
      />,
    );

    expect(markup).toContain("Clock context menu");
    expect(markup).toContain("Configure Clock...");
    expect(markup).toContain('data-menu-item-id="clock-configure"');
    expect(markup).toContain("k-menu-popup--context");
    expect(markup).not.toContain("Calendar");
    expect(markup).not.toContain("separator");
  });

  it("keeps the popup fixed and reuses the measured logical position boundary", () => {
    const source = readFileSync(new URL("./ClockContextMenu.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../../theme/controls.css", import.meta.url), "utf8");

    expect(source).toContain("useMeasuredPopupPosition");
    expect(source).toContain("useApplicationMenuDismissal");
    expect(source).toContain("clockRef");
    expect(css).toContain(".clock-context-menu-popup");
    expect(css).toMatch(/\.clock-context-menu-popup\s*\{[\s\S]*?position: fixed;/);
  });
});
