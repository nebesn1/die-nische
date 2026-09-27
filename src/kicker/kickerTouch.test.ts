import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const controls = readSource("../theme/controls.css");
const kde3 = readSource("../theme/kde3.css");
const kMenuButton = readSource("./k-menu/KMenuButton.tsx");
const pager = readSource("./VirtualDesktopPager.tsx");
const clock = readSource("./DigitalClock/DigitalClock.tsx");
const indexHtml = readSource("../../index.html");

describe("Kicker touch interaction boundary", () => {
  it("keeps Start, Pager, and Clock on their existing single click action paths", () => {
    expect(kMenuButton).toContain("onClick={onToggle}");
    expect(pager).toContain("onClick={() => switchDesktop(desktop)}");
    expect(clock).toContain("onClick={launchCalendar}");
    expect(controls).toContain(".kicker-launcher");
    expect(controls).toContain(".pager__cell");
    expect(controls).toContain(".digital-clock");
    expect(controls).toMatch(/\.kicker-launcher\s*\{[\s\S]*?touch-action:\s*manipulation;/);
    expect(controls).toMatch(/\.pager__cell\s*\{[\s\S]*?touch-action:\s*manipulation;/);
    expect(controls).toMatch(/\.digital-clock\s*\{[\s\S]*?touch-action:\s*manipulation;/);
  });

  it("preserves browser pinch zoom and scopes touch-action none to drag surfaces", () => {
    expect(indexHtml).not.toContain("user-scalable=no");
    expect(indexHtml).not.toContain("maximum-scale=1");
    expect(kde3).toContain(".window-titlebar {");
    expect(kde3).toContain(".resize-handle {");
    expect(kde3).not.toMatch(/(?:html|body|#root|\.desktop-shell)\s*\{[^}]*touch-action:\s*none;/s);
    expect(controls).toContain(".k-menu-list");
    expect(controls).toContain("touch-action: pan-y;");
  });
});
