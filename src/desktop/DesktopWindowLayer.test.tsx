import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getApplicationDefinition } from "../application-runtime/applicationRegistry";
import { createApplicationWindow } from "../application-runtime/createApplicationWindow";
import { ApplicationLauncherContext } from "../application-runtime/useApplicationLauncher";
import { Kicker } from "../kicker/Kicker";
import { WindowManagerContext, type WindowManagerContextValue } from "../window-manager/useWindowManager";
import { WindowMenuContext } from "../window-manager/window-menu/WindowMenuContext";
import type { WindowMenuContextValue } from "../window-manager/window-menu/types";
import type { WorkArea } from "../window-manager/types";
import type { LaunchApplicationResult } from "../application-runtime/types";
import { VfsProvider } from "../vfs/VfsProvider";
import { DesktopIcons } from "./DesktopIcons";
import { DesktopPopupLayer } from "./DesktopPopupLayer";
import { DesktopTransientPopupLayer, DesktopTransientPopupProvider } from "./DesktopTransientPopupLayer";
import { DesktopSessionProvider } from "./DesktopSessionContext";
import { DesktopWindowLayer } from "./DesktopWindowLayer";
import { WindowPopupLayer } from "./WindowPopupLayer";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 1024,
  height: 722,
  titleBarHeight: 22,
};

const getRequiredApplicationDefinition = (appId: "about-kde" | "konqueror") => {
  const definition = getApplicationDefinition(appId);

  if (!definition) {
    throw new Error(`${appId} definition is required for DesktopWindowLayer tests`);
  }

  return definition;
};

const windows = [
  createApplicationWindow(getRequiredApplicationDefinition("about-kde"), { zIndex: 20, isActive: false }),
  createApplicationWindow(getRequiredApplicationDefinition("konqueror"), { zIndex: 30, isActive: true }),
];

const windowManagerContext: WindowManagerContextValue = {
  windows,
  currentDesktopId: 1,
  lastActiveWindowIdByDesktop: {
    1: "app:konqueror",
    2: null,
    3: null,
    4: null,
  },
  showDesktopSessionByDesktop: {
    1: null,
    2: null,
    3: null,
    4: null,
  },
  workArea,
  activateWindow: vi.fn(),
  focusWindow: vi.fn(),
  openWindow: vi.fn(),
  moveWindow: vi.fn(),
  resizeWindow: vi.fn(),
  minimizeWindow: vi.fn(),
  restoreWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  restoreMaximizedWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  toggleTaskbarWindow: vi.fn(),
  switchDesktop: vi.fn(),
  toggleShowDesktop: vi.fn(),
  moveWindowToDesktop: vi.fn(),
  setWorkArea: vi.fn(),
};

const launchApplication = vi.fn((appId: string): LaunchApplicationResult => {
  void appId;
  return "already-active";
});
const launchNewApplicationInstance = vi.fn((appId: string): LaunchApplicationResult => {
  void appId;
  return "already-active";
});

const windowMenuContext: WindowMenuContextValue = {
  state: {
    openWindowId: null,
    openSubmenuId: null,
    activeItemId: null,
    anchor: null,
  },
  openWindowMenu: vi.fn(),
  toggleWindowMenu: vi.fn(),
  closeWindowMenu: vi.fn(),
  setActiveItem: vi.fn(),
  openSubmenu: vi.fn(),
  closeSubmenu: vi.fn(),
};

const renderWithDesktopContexts = (
  children: React.ReactNode,
  context: WindowManagerContextValue = windowManagerContext,
): string =>
  renderToStaticMarkup(
    <VfsProvider>
      <WindowManagerContext.Provider value={context}>
        <ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance }}>
          <WindowMenuContext.Provider value={windowMenuContext}>
            <DesktopTransientPopupProvider>
              <DesktopSessionProvider>{children}</DesktopSessionProvider>
            </DesktopTransientPopupProvider>
          </WindowMenuContext.Provider>
        </ApplicationLauncherContext.Provider>
      </WindowManagerContext.Provider>
    </VfsProvider>,
  );

const readThemeFile = (fileName: string): string => {
  return readFileSync(new URL(`../theme/${fileName}`, import.meta.url), "utf8");
};

const readLayerToken = (css: string, tokenName: string): number => {
  const match = css.match(new RegExp(`${tokenName}:\\s*(\\d+);`));

  if (!match) {
    throw new Error(`Missing ${tokenName}`);
  }

  return Number(match[1]);
};

describe("DesktopWindowLayer", () => {
  it("keys mounted application hosts by their window identity while looking up definitions through appId", () => {
    const source = readFileSync(new URL("./DesktopWindowLayer.tsx", import.meta.url), "utf8");
    const hostSource = readFileSync(new URL("../application-runtime/ApplicationHost.tsx", import.meta.url), "utf8");

    expect(source).toContain("key={desktopWindow.id}");
    expect(source).toContain("<WindowOwnedPopupLayer key={desktopWindow.id} desktopWindow={desktopWindow}>");
    expect(source).toContain("desktopWindow={desktopWindow}");
    expect(hostSource).toContain("getApplicationDefinition(appId)");
    expect(hostSource).toContain("getLaunchRequestForWindow(windowId)");
  });

  it("renders WindowFrame roots inside an explicit desktop window layer", () => {
    const markup = renderWithDesktopContexts(<DesktopWindowLayer />);

    expect(markup).toContain("class=\"desktop-window-layer\"");
    expect(markup).toContain("class=\"window-frame");
    expect(markup).toContain("class=\"window-owned-popup-layer\"");
    expect(markup).toContain('data-window-id="app:konqueror"');
    expect(markup).toContain("style=\"left:500px;top:2px;right:-126px;bottom:120px;z-index:30\"");
  });

  it("uses each WindowId semantic metadata icon for the WindowFrame titlebar while preserving fallback icons", () => {
    const markup = renderWithDesktopContexts(<DesktopWindowLayer />, {
      ...windowManagerContext,
      launcherMetadataByWindowId: {
        "app:konqueror": { isHomeLocation: false, semanticIconId: "documents" },
      },
    });

    expect(markup).toMatch(/window-titlebar__icon-button[^>]*><svg[^>]*aria-label="Documents folder"/);
    expect(markup).toMatch(/window-titlebar__icon-button[^>]*><svg[^>]*aria-label="Settings"/);
  });

  it("places shell transient popups after Kicker while keeping normal windows below it", () => {
    const markup = renderWithDesktopContexts(
      <main className="desktop-shell">
        <DesktopIcons
          selectedIconId={null}
          onSelectIcon={() => undefined}
          onClearSelection={() => undefined}
          onOpenIcon={() => undefined}
          onOpenContextMenu={() => undefined}
        />
        <DesktopWindowLayer />
        <Kicker />
        <DesktopTransientPopupLayer>
          <WindowPopupLayer />
          <DesktopPopupLayer>{null}</DesktopPopupLayer>
        </DesktopTransientPopupLayer>
      </main>,
    );
    const iconIndex = markup.indexOf("class=\"desktop-icons\"");
    const layerIndex = markup.indexOf("class=\"desktop-window-layer\"");
    const windowIndex = markup.indexOf("class=\"window-frame", layerIndex);
    const transientLayerIndex = markup.indexOf("class=\"desktop-transient-popup-layer\"");
    const popupLayerIndex = markup.indexOf("class=\"window-popup-layer\"");
    const desktopPopupLayerIndex = markup.indexOf("class=\"desktop-popup-layer\"");
    const kickerIndex = markup.indexOf("class=\"kicker\"");

    expect(iconIndex).toBeGreaterThan(-1);
    expect(layerIndex).toBeGreaterThan(iconIndex);
    expect(windowIndex).toBeGreaterThan(layerIndex);
    expect(kickerIndex).toBeGreaterThan(layerIndex);
    expect(transientLayerIndex).toBeGreaterThan(kickerIndex);
    expect(popupLayerIndex).toBeGreaterThan(transientLayerIndex);
    expect(desktopPopupLayerIndex).toBeGreaterThan(popupLayerIndex);
    expect(markup).toContain("</footer><section class=\"desktop-transient-popup-layer\"");
    expect(markup).toContain("<section class=\"window-popup-layer\"");
    expect(markup).toContain("</section><section class=\"desktop-popup-layer\"");
    expect(markup).toContain("</section><footer class=\"kicker\"");
  });

  it("defines ordered desktop stacking layer tokens and applies them to layer classes", () => {
    const tokens = readThemeFile("tokens.css");
    const kde3 = readThemeFile("kde3.css");
    const controls = readThemeFile("controls.css");

    expect(readLayerToken(tokens, "--kde-z-desktop-background")).toBeLessThan(
      readLayerToken(tokens, "--kde-z-desktop-icons"),
    );
    expect(readLayerToken(tokens, "--kde-z-desktop-icons")).toBeLessThan(readLayerToken(tokens, "--kde-z-windows"));
    expect(readLayerToken(tokens, "--kde-z-windows")).toBeLessThan(readLayerToken(tokens, "--kde-z-kicker"));
    expect(readLayerToken(tokens, "--kde-z-kicker")).toBeLessThan(readLayerToken(tokens, "--kde-z-transient-popup"));
    expect(readLayerToken(tokens, "--kde-z-transient-popup")).toBeLessThan(
      readLayerToken(tokens, "--kde-z-system-overlay"),
    );

    expect(kde3).toContain(".desktop-window-layer");
    expect(kde3).toContain(".window-popup-layer");
    expect(kde3).toContain(".desktop-popup-layer");
    expect(kde3).toContain(".desktop-transient-popup-layer");
    expect(kde3).toContain(".window-owned-popup-layer");
    expect(kde3).toContain("z-index: var(--kde-z-windows)");
    expect(kde3).toContain("z-index: var(--kde-z-transient-popup)");
    expect(kde3).toContain("isolation: isolate");
    expect(kde3).toContain("pointer-events: none");
    expect(controls).toContain("z-index: var(--kde-z-kicker)");
  });

  it("keeps application popups in an owner-scoped portal outside WindowFrame clipping without using a body portal", () => {
    const popupLayerSource = readFileSync(new URL("./WindowOwnedPopupLayer.tsx", import.meta.url), "utf8");
    const popupPortalSource = readFileSync(new URL("./WindowOwnedPopupPortal.tsx", import.meta.url), "utf8");
    const frameSource = readFileSync(new URL("../window-manager/WindowFrame.tsx", import.meta.url), "utf8");
    const css = readThemeFile("kde3.css");

    expect(popupPortalSource).toContain("createPortal(children, popupContext.popupLayer)");
    expect(popupLayerSource).toContain("data-window-id={desktopWindow.id}");
    expect(popupLayerSource).toContain("dismissGeneration");
    expect(popupLayerSource).toContain("containsPopupTarget");
    expect(popupLayerSource).toContain("useDesktopTransientPopupLayer");
    expect(popupLayerSource).toContain("createPortal(popupLayerElement, transientPopupLayer.layer)");
    expect(popupLayerSource).toContain("desktopWindow.desktopId !== currentDesktopId");
    expect(popupLayerSource).toContain("showDesktopSessionByDesktop[desktopWindow.desktopId]");
    expect(popupLayerSource).toContain("hidden={isHidden}");
    expect(popupPortalSource).not.toContain("document.body");
    expect(popupLayerSource).not.toContain("querySelector");
    expect(popupLayerSource).not.toMatch(/zIndex:\s*9{3,}/);
    expect(frameSource).toContain("popupLayer?.containsPopupTarget(event.target)");
    expect(frameSource).toContain("popupLayer?.dismissPopups()");
    expect(css).toMatch(/\.window-frame\s*\{[\s\S]*?overflow: hidden;/);
    expect(css).toMatch(/\.window-owned-popup-layer\s*\{[\s\S]*?overflow: visible;[\s\S]*?pointer-events: none;/);
  });
});
