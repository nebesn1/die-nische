import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const desktopSource = readSource("./Desktop.tsx");
const backgroundSource = readSource("./DesktopBackgroundSurface.tsx");
const popupSource = readSource("./DesktopContextMenu.tsx");
const iconSource = readSource("./DesktopIcon.tsx");
const cssSource = readSource("../theme/kde3.css");

describe("Desktop context-menu integration boundaries", () => {
  it("uses one canonical background sibling beneath icons, windows, panel chrome, and transient popups", () => {
    const background = desktopSource.indexOf("<DesktopBackgroundSurface");
    const icons = desktopSource.indexOf("<DesktopIcons");
    const windows = desktopSource.indexOf("<DesktopWindowLayer />");
    const kicker = desktopSource.indexOf("<Kicker />");
    const popup = desktopSource.indexOf("<DesktopTransientPopupLayer>");

    expect(background).toBeGreaterThan(-1);
    expect(icons).toBeGreaterThan(background);
    expect(windows).toBeGreaterThan(icons);
    expect(kicker).toBeGreaterThan(windows);
    expect(popup).toBeGreaterThan(kicker);
    expect(desktopSource).not.toContain("onPointerDownCapture");
    expect(backgroundSource).toContain("event.preventDefault()");
    expect(backgroundSource).toContain("onOpenContextMenu(event.clientX, event.clientY)");
  });

  it("uses a local icon context-menu handler without broadening the background boundary", () => {
    expect(iconSource).toContain("onContextMenu={handleContextMenu}");
    expect(iconSource).toContain("event.stopPropagation()");
    expect(backgroundSource).not.toContain("document.addEventListener");
    expect(backgroundSource).not.toContain("window.addEventListener");
    expect(desktopSource).not.toContain("addEventListener(\"contextmenu\"");
    expect(desktopSource).not.toContain("document.oncontextmenu");
    expect(desktopSource).not.toContain("window.oncontextmenu");
  });

  it("dispatches desktop actions after closing and routes icon opens through shared authorities", () => {
    expect(desktopSource).toContain("dismissDesktopContextMenu();");
    expect(desktopSource).toContain("getDesktopIconDefinition(iconId)");
    expect(desktopSource).toContain("getDesktopIconLaunchRequest(definition)");
    expect(desktopSource).toContain('userLaunchApplication("kcontrol", { intent: createControlCenterOpenIntent({ module: "behavior" }) })');
    expect(desktopSource).toContain("getRunCommandPlan(vfs.state, runCommandInput)");
    expect(desktopSource).toContain("executeRunCommandPlan(plan");
    expect(desktopSource).not.toContain("if (plan.type === \"application\")");
    expect(desktopSource).toContain("<RunCommandDialog");
    expect(desktopSource).toContain('import { RunCommandDialog } from "../kicker/k-menu/RunCommandDialog"');
    expect(desktopSource).toContain("lockSession();");
    expect(desktopSource).toContain("openLogout?.();");
    expect(desktopSource).not.toContain('userLaunchNewApplicationInstance("kfind")');
    expect(desktopSource).not.toContain('userLaunchNewApplicationInstance("konsole")');
    expect(desktopSource).not.toContain('userLaunchApplication("about-kde")');
    expect(popupSource).toContain("useApplicationMenuDismissal");
    expect(popupSource).not.toMatch(/(?:create|rename|write|copy|move|trash|restore|delete)Vfs/i);
  });

  it("uses a non-scrolling shell transient layer, screen bounds, and no body portal", () => {
    expect(desktopSource).toContain("screenArea={screenArea ?? workArea}");
    expect(popupSource).toContain("getDesktopScreenAreaLocalBounds(screenArea, containerBounds)");
    expect(popupSource).not.toContain("createPortal");
    expect(desktopSource).toContain("DesktopTransientPopupLayer");
    expect(cssSource).toContain(".desktop-popup-layer");
    expect(cssSource).toContain(".desktop-transient-popup-layer");
    expect(cssSource).toContain(".desktop-context-menu");
    expect(cssSource).not.toContain(".desktop-popup-layer {\n  overflow: auto");
  });

  it("closes the local popup on virtual-desktop changes without persistence", () => {
    expect(desktopSource).toContain("[currentDesktopId, dismissDesktopContextMenu]");
    expect(desktopSource).not.toContain("localStorage");
    expect(desktopSource).not.toContain("sessionStorage");
    expect(desktopSource).not.toContain("indexedDB");
  });
});
