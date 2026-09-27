import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string => {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
};

const controls = readSource("../theme/controls.css");
const tokens = readSource("../theme/tokens.css");
const kicker = readSource("./Kicker.tsx");
const taskbar = readSource("./Taskbar.tsx");
const clipboard = readSource("./ClipboardApplet.tsx");
const clock = readSource("./DigitalClock/DigitalClock.tsx");
const responsiveLayout = readSource("../desktop/responsiveLayoutContext.ts");

describe("mobile Kicker presentation", () => {
  it("uses the existing layout-mode root and keeps the three required regions", () => {
    expect(controls).toMatch(/\.desktop-shell\[data-layout-mode="mobile"\] > \.kicker\s*\{[\s\S]*?display:\s*flex;[\s\S]*?gap:\s*3px;/);
    expect(controls).toContain("flex: 0 0 auto;");
    expect(controls).toContain("margin-left: auto;");
    expect(kicker).toContain("<KMenu />");
    expect(kicker).toContain("<VirtualDesktopPager />");
    expect(kicker).toContain("<DigitalClock />");
    expect(kicker).not.toContain("window.innerWidth");
    expect(kicker).not.toContain("navigator.userAgent");
    expect(responsiveLayout).toContain("export function useOptionalResponsiveLayout");
  });

  it("removes only nonessential Kicker presentation from the mobile flow", () => {
    const hiddenBlock = controls.slice(controls.indexOf(".desktop-shell[data-layout-mode=\"mobile\"] > .kicker > .quick-launch"));

    expect(hiddenBlock).toMatch(/\.quick-launch[\s\S]*?\.kicker-separator[\s\S]*?\.taskbar[\s\S]*?\.clipboard-applet[\s\S]*?display:\s*none;/);
    expect(hiddenBlock).toContain(".k-menu-root");
    expect(hiddenBlock).toContain(".pager");
    expect(hiddenBlock).toContain(".digital-clock");
    expect(tokens).toContain("--kde-panel-height: 46px;");
    expect(controls).not.toContain("@media");
  });

  it("keeps the real pager count and places it directly after Start in the mobile flow", () => {
    expect(controls).toContain("--pager-columns, 2");
    expect(controls).toContain("grid-template-columns: repeat(var(--pager-columns, 2), minmax(0, 1fr));");
    expect(controls).toContain("calc(100% - var(--kde-kicker-mobile-k-width) - var(--kde-kicker-mobile-clock-width) - 6px)");
    expect(controls).toContain(".desktop-shell[data-layout-mode=\"mobile\"] > .kicker > .pager");
    expect(controls).not.toContain("justify-self: center;");
    expect(tokens).toContain("--kde-kicker-mobile-pager-cell-size: 16px;");
    expect(kicker).toContain("<Taskbar />");
    expect(kicker).toContain("<ClipboardApplet />");
  });

  it("retains one locale-aware clock state while fitting the mobile right region", () => {
    expect(clock).toContain("const [now, setNow] = useState(() => new Date());");
    expect(clock).toContain("window.setInterval");
    expect(clock).toContain("getClockParts(now, locale)");
    expect(clock).toContain("preferences.showClockDate");
    expect(controls).toContain("--kde-kicker-mobile-clock-width");
    expect(controls).toContain(".digital-clock__date");
  });

  it("clamps K Menu and cascade widths to the logical viewport without changing desktop width", () => {
    expect(controls).toMatch(/\.k-menu-panel,\s*\.k-menu-submenu\s*\{[\s\S]*?width:\s*238px;/);
    expect(controls).toContain("width: min(238px, var(--kde-logical-viewport-width));");
    expect(controls).toContain("max-width: var(--kde-logical-viewport-width);");
    expect(controls).toMatch(/\.k-menu-list\s*\{[\s\S]*?overflow-y:\s*auto;/);
    expect(controls).toMatch(/\.k-menu-submenu\.is-positioned\s*\{[\s\S]*?overflow-y:\s*auto;/);
  });

  it("closes hidden Kicker-owned popup presentation on a live switch to mobile", () => {
    expect(taskbar).toContain("useOptionalResponsiveLayout");
    expect(taskbar).toContain('responsiveLayout?.layoutMode !== "mobile"');
    expect(taskbar).toContain("setOpenGroupAppId(null);");
    expect(taskbar).toContain("setContextMenuState(null);");
    expect(clipboard).toContain("useOptionalResponsiveLayout");
    expect(clipboard).toContain('responsiveLayout?.layoutMode === "mobile"');
    expect(clipboard).toContain("closeClipboard();");
  });
});
