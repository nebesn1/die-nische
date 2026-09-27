// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClipboardWriteFailureMessage, type ClipboardAdapter } from "../kicker/clipboardAdapter";
import { WindowManagerContext, type WindowManagerContextValue } from "../window-manager/useWindowManager";
import { DesktopSessionProvider } from "./DesktopSessionContext";
import { useDesktopSession } from "./useDesktopSession";

let container: HTMLDivElement;
let reactRoot: Root;

const windowManager: WindowManagerContextValue = {
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
};

function ClipboardProbe() {
  const session = useDesktopSession();
  return (
    <>
      <button type="button" onClick={() => void session.writeClipboard("0xFF")}>Write</button>
      <button type="button" onClick={session.clearClipboardHistory}>Clear history</button>
      <output data-current-text={session.readClipboardText() ?? ""} data-has-text={session.hasClipboardText} data-history-count={session.clipboardHistory.length} data-status={session.clipboardStatus ?? ""} />
    </>
  );
}

const getOutput = (): HTMLOutputElement => {
  const output = container.querySelector<HTMLOutputElement>("output");
  if (!output) throw new Error("Missing clipboard probe");
  return output;
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("DesktopSession shared text clipboard", () => {
  it("retains the session text synchronously when browser clipboard writing is unavailable", async () => {
    const clipboard: ClipboardAdapter = { writeText: vi.fn().mockRejectedValue(new Error("denied")) };

    await act(async () => {
      reactRoot.render(
        <WindowManagerContext.Provider value={windowManager}>
          <DesktopSessionProvider clipboard={clipboard}><ClipboardProbe /></DesktopSessionProvider>
        </WindowManagerContext.Provider>,
      );
    });
    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(getOutput().dataset).toMatchObject({
      currentText: "0xFF",
      hasText: "true",
      historyCount: "1",
      status: getClipboardWriteFailureMessage(),
    });

    act(() => (container.querySelectorAll("button")[1] as HTMLButtonElement).click());
    expect(getOutput().dataset).toMatchObject({ currentText: "0xFF", hasText: "true", historyCount: "0" });
  });
});
