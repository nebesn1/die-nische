import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApplicationLauncherContext } from "../application-runtime/useApplicationLauncher";
import type { LaunchApplicationOptions, LaunchApplicationResult } from "../application-runtime/types";
import { WindowManagerContext, type WindowManagerContextValue } from "../window-manager/useWindowManager";
import type { DesktopWindow, WorkArea } from "../window-manager/types";
import { QuickLaunch } from "./QuickLaunch";
import { getQuickLaunchOpenState } from "./quickLaunchOpenState";

const launchApplication = vi.fn((appId: string, options?: LaunchApplicationOptions): LaunchApplicationResult => {
  void appId;
  void options;
  return "already-active";
});
const launchNewApplicationInstance = vi.fn((appId: string, options?: LaunchApplicationOptions): LaunchApplicationResult => {
  void appId;
  void options;
  return "already-active";
});

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 640,
  titleBarHeight: 22,
};

const makeWindowManagerContext = (
  showDesktopSessionByDesktop: WindowManagerContextValue["showDesktopSessionByDesktop"] = {
    1: null,
    2: null,
    3: null,
    4: null,
  },
  currentDesktopId: WindowManagerContextValue["currentDesktopId"] = 1,
): WindowManagerContextValue => ({
  windows: [],
  currentDesktopId,
  lastActiveWindowIdByDesktop: {
    1: null,
    2: null,
    3: null,
    4: null,
  },
  showDesktopSessionByDesktop,
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
});

const renderQuickLaunch = (context: WindowManagerContextValue = makeWindowManagerContext()) =>
  renderToStaticMarkup(
    <WindowManagerContext.Provider value={context}>
      <ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance }}>
        <QuickLaunch />
      </ApplicationLauncherContext.Provider>
    </WindowManagerContext.Provider>,
  );

const konquerorWindow = (id: string, desktopId: DesktopWindow["desktopId"] = 1): DesktopWindow => ({
  id,
  appId: "konqueror",
  title: "Documents - Konqueror",
  iconId: "konqueror",
  desktopId,
  bounds: { x: 0, y: 0, width: 400, height: 300 },
  zIndex: 1,
  isActive: false,
  state: "minimized",
  isDraggable: true,
  minimumWidth: 240,
  minimumHeight: 160,
  isResizable: true,
});

describe("QuickLaunch", () => {
  it("aggregates Konqueror and Home presence on the current desktop by WindowId metadata", () => {
    const first = konquerorWindow("app:konqueror", 1);
    const second = konquerorWindow("app:konqueror::2", 1);
    const offDesktop = konquerorWindow("app:konqueror::3", 2);

    expect(getQuickLaunchOpenState([first, second, offDesktop], 1, {
      [first.id]: { isHomeLocation: true },
      [second.id]: { isHomeLocation: true },
      [offDesktop.id]: { isHomeLocation: true },
    })).toEqual({ konqueror: true, home: true });
    expect(getQuickLaunchOpenState([offDesktop], 1, {
      [offDesktop.id]: { isHomeLocation: true },
    })).toEqual({ konqueror: false, home: false });
    expect(getQuickLaunchOpenState([first, second], 1, {
      [first.id]: { isHomeLocation: false },
      [second.id]: { isHomeLocation: false },
    })).toEqual({ konqueror: true, home: false });
  });

  it("maps semantic presence to fixed-size open icon variants without making launcher buttons toggles", () => {
    const closedMarkup = renderQuickLaunch();
    const home = konquerorWindow("app:konqueror");
    const openMarkup = renderQuickLaunch({
      ...makeWindowManagerContext(),
      windows: [home, konquerorWindow("app:konqueror::2")],
      launcherMetadataByWindowId: { [home.id]: { isHomeLocation: true } },
    });

    expect(closedMarkup).toMatch(/aria-label="Home"[^>]*>\s*<span class="quick-launch__icon" data-icon-variant="closed"/);
    expect(closedMarkup).toMatch(/aria-label="Konqueror"[^>]*>\s*<span class="quick-launch__icon" data-icon-variant="closed"/);
    expect(openMarkup).toMatch(/aria-label="Home"[^>]*>\s*<span class="quick-launch__icon" data-icon-variant="open"/);
    expect(openMarkup).toMatch(/aria-label="Konqueror"[^>]*>\s*<span class="quick-launch__icon" data-icon-variant="open"/);
    expect(openMarkup).toContain("homeOpenWall");
    expect(openMarkup).toContain('d="M8 8h23v20H8z"');
    expect(openMarkup).not.toContain("kicker-button is-open");
    expect(openMarkup).not.toContain("data-window-open");
    expect(openMarkup).not.toMatch(/aria-label="(?:Home|Konqueror)"[^>]*aria-pressed/);
  });

  it("renders only the current Quick Launch applications and keeps About KDE out of the panel", () => {
    const markup = renderQuickLaunch();

    expect(markup).toContain("aria-label=\"Home\"");
    expect(markup).toContain("aria-label=\"Konqueror\"");
    expect(markup).toContain("aria-label=\"Konsole\"");
    expect(markup).not.toContain("aria-label=\"Help\"");
    expect(markup).not.toContain("about-kde");
  });

  it("enables Konsole as an application launcher", () => {
    const markup = renderQuickLaunch();

    expect(markup).toContain("aria-label=\"Konsole\"");
    expect(markup).not.toContain("Konsole is not implemented yet");
  });

  it("marks the explicit Konsole launcher as a new-instance action", () => {
    const source = readFileSync(new URL("./QuickLaunch.tsx", import.meta.url), "utf8");

    expect(source).toContain('appId: "konsole", newInstance: true');
  });

  it("renders Show Desktop as an unpressed button by default", () => {
    const markup = renderQuickLaunch();

    expect(markup).toContain("aria-label=\"Show Desktop\"");
    expect(markup).toContain("aria-pressed=\"false\"");
    expect(markup).not.toContain("aria-label=\"Restore windows\"");
  });

  it("renders Show Desktop as pressed for the current desktop session", () => {
    const markup = renderQuickLaunch(
      makeWindowManagerContext({
        1: {
          windowIds: ["app:konqueror"],
          previouslyActiveWindowId: "app:konqueror",
        },
        2: null,
        3: null,
        4: null,
      }),
    );

    expect(markup).toContain("aria-label=\"Restore windows\"");
    expect(markup).toContain("aria-pressed=\"true\"");
    expect(markup).toContain("kicker-button is-active");
  });

  it("uses the target desktop session for pressed state after desktop switching", () => {
    const markup = renderQuickLaunch(
      makeWindowManagerContext(
        {
          1: {
            windowIds: ["app:konqueror"],
            previouslyActiveWindowId: "app:konqueror",
          },
          2: null,
          3: null,
          4: null,
        },
        2,
      ),
    );

    expect(markup).toContain("aria-label=\"Show Desktop\"");
    expect(markup).toContain("aria-pressed=\"false\"");
  });

  it("keeps Kicker Home at Home and sends generic Konqueror to the Start Page", () => {
    const source = readFileSync(new URL("./QuickLaunch.tsx", import.meta.url), "utf8");

    expect(source).toContain('createKonquerorOpenLocationIntent("home")');
    expect(source).not.toContain('createKonquerorOpenLocationIntent("documents")');
    expect(source).toContain('id: "konqueror"');
    expect(source).toContain("createKonquerorOpenStartIntent()");
    expect(source).toContain("launchNewApplicationInstance");
    expect(source).toContain('id: "konsole"');
    expect(source).toContain('action: { type: "launch-application", appId: "konsole", newInstance: true }');
  });

  it("uses current-desktop semantic aggregation rather than a title or first-instance binding", () => {
    const source = readFileSync(new URL("./quickLaunchOpenState.ts", import.meta.url), "utf8");

    expect(source).toContain("getQuickLaunchOpenState");
    expect(source).toContain("desktopWindow.desktopId === currentDesktopId");
    expect(source).toContain("isHomeLocation");
    expect(source).not.toContain('title === "user - Konqueror"');
  });

  it("keeps icon variant dimensions stable and reserves persistent pressed styling for Show Desktop", () => {
    const controls = readFileSync(new URL("../theme/controls.css", import.meta.url), "utf8");
    const source = readFileSync(new URL("./QuickLaunch.tsx", import.meta.url), "utf8");

    expect(controls).toContain(".quick-launch__icon,");
    expect(controls).toContain("--kde-kicker-launcher-icon-size");
    expect(controls).toContain("width: var(--kde-kicker-launcher-icon-size);");
    expect(controls).toContain("height: var(--kde-kicker-launcher-icon-size);");
    expect(controls).toContain(".quick-launch .kicker-button");
    expect(controls).toContain("padding: 1px;");
    expect(controls).not.toContain(".kicker-button.is-open");
    expect(source).toContain('aria-pressed={isShowDesktopButton ? isPressed : undefined}');
    expect(source).toContain('className={`kicker-launcher kicker-button${isPressed ? " is-active" : ""}`}');
    expect(controls).toContain(".kicker-launcher");
  });

  it("does not remove the About KDE application from its other launch routes", () => {
    const taskbarMenu = readFileSync(new URL("./taskbarContextMenuModel.ts", import.meta.url), "utf8");

    expect(taskbarMenu).toContain('application("taskbar-about-kde", "About KDE", "about", "about-kde")');
  });
});
