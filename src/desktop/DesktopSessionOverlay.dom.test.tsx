// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationRuntimeContext } from "../application-runtime/ApplicationRuntimeContext";
import { WindowManagerContext, type WindowManagerContextValue } from "../window-manager/useWindowManager";
import { DesktopSessionOverlay } from "./DesktopSessionOverlay";
import { DesktopSessionProvider } from "./DesktopSessionContext";
import { useDesktopSession } from "./useDesktopSession";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let reactRoot: Root | null = null;

afterEach(() => {
  act(() => reactRoot?.unmount());
  container?.remove();
  container = null;
  reactRoot = null;
});

function LogoutProbe() {
  const session = useDesktopSession();
  return <button type="button" onClick={session.openLogout}>Open logout</button>;
}

const createWindowManager = (resetSession: () => void): WindowManagerContextValue => ({
  windows: [],
  currentDesktopId: 1,
  lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null },
  showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
  workArea: { x: 0, y: 0, width: 900, height: 640, titleBarHeight: 22 },
  screenArea: { x: 0, y: 0, width: 900, height: 686 },
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
  resetSession,
});

describe("K Menu logout session dialog", () => {
  it("uses the focused KDE-style Logout confirmation and delegates confirmation to the existing reset boundaries", () => {
    container = document.createElement("div");
    document.body.append(container);
    reactRoot = createRoot(container);
    const resetWindows = vi.fn();
    const resetRuntime = vi.fn();

    act(() => reactRoot?.render(
      <WindowManagerContext.Provider value={createWindowManager(resetWindows)}>
        <ApplicationRuntimeContext.Provider value={{
          getLaunchRequestForWindow: () => null,
          getCloseRequestForWindow: () => null,
          requestWindowClose: vi.fn(),
          commitWindowClose: vi.fn(),
          cancelWindowClose: vi.fn(),
          resetApplicationSession: resetRuntime,
        }}>
          <DesktopSessionProvider><LogoutProbe /><DesktopSessionOverlay /></DesktopSessionProvider>
        </ApplicationRuntimeContext.Provider>
      </WindowManagerContext.Provider>,
    ));

    const open = container.querySelector<HTMLButtonElement>("button");
    if (!open) throw new Error("Missing logout opener.");
    act(() => open.click());
    const dialog = container.querySelector<HTMLElement>("[aria-label='End Session']");
    if (!dialog) throw new Error("Missing logout dialog.");
    expect(dialog.textContent).toContain('End Session for "user"');
    expect([...dialog.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Logout", "Cancel"]);

    act(() => dialog.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
    expect(container.querySelector("[aria-label='End Session']")).toBeNull();
    expect(resetWindows).not.toHaveBeenCalled();
    expect(resetRuntime).not.toHaveBeenCalled();

    act(() => open.click());
    const confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Logout");
    if (!confirm) throw new Error("Missing Logout confirmation.");
    act(() => confirm.click());
    expect(resetWindows).toHaveBeenCalledTimes(1);
    expect(resetRuntime).toHaveBeenCalledTimes(1);
  });
});
