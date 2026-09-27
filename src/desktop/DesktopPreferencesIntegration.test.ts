import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const desktopSource = readFileSync(fileURLToPath(new URL("./Desktop.tsx", import.meta.url)), "utf8");
const cssSource = readFileSync(fileURLToPath(new URL("../theme/kde3.css", import.meta.url)), "utf8");

describe("desktop preferences integration", () => {
  it("uses applied preferences declaratively for background and desktop-icon visibility", () => {
    expect(desktopSource).toContain("DesktopPreferencesProvider");
    expect(desktopSource).toContain("desktop-shell--background-${preferences.backgroundPreset}");
    expect(desktopSource).toContain("preferences.showDesktopIcons ?");
    expect(desktopSource).toContain("!preferences.showDesktopIcons && desktopIconSelection.selectedIconId !== null");
    expect(desktopSource).toContain("<DesktopWindowLayer />");
    expect(desktopSource).toContain("<DesktopBackgroundSurface");
    expect(desktopSource).toContain("<DesktopPopupLayer>");
    expect(desktopSource).toContain("<Kicker />");
    expect(desktopSource).not.toContain("document.body.style");
  });

  it("keeps classic desktop styling and maps all finite presets through fixed CSS classes", () => {
    expect(cssSource).toContain(".desktop-shell--background-kde-classic");
    expect(cssSource).toContain(".desktop-shell--background-deep-blue");
    expect(cssSource).toContain(".desktop-shell--background-teal");
    expect(cssSource).toContain(".desktop-shell--background-slate");
    expect(cssSource).toContain(".desktop-shell--background-black");
  });

  it("limits the icon preference branch to the icon layer and clears only a real selection", () => {
    const iconBranch = desktopSource.indexOf("preferences.showDesktopIcons ?");
    const windowLayer = desktopSource.indexOf("<DesktopWindowLayer />");
    const kicker = desktopSource.indexOf("<Kicker />");

    expect(iconBranch).toBeGreaterThan(-1);
    expect(windowLayer).toBeGreaterThan(iconBranch);
    expect(kicker).toBeGreaterThan(windowLayer);
    expect(desktopSource).toContain("<DesktopBackgroundSurface");
    expect(desktopSource).not.toContain("document.querySelector");
  });
});
