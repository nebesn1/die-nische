// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nContext } from "../../i18n/I18nContext";
import { createTranslator } from "../../i18n/translate";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { KMenuPanel } from "./KMenuPanel";
import { initialKMenuState } from "./menuState";
import type { KMenuEntry } from "./types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const makeWindowManager = (): WindowManagerContextValue => {
  const noop = vi.fn();
  return {
    windows: [],
    currentDesktopId: 1,
    desktopCount: 4,
    lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null },
    showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
    layoutMode: "mobile",
    workArea: { x: 0, y: 0, width: 320, height: 500, titleBarHeight: 22 },
    screenArea: { x: 0, y: 0, width: 320, height: 546 },
    activateWindow: noop,
    focusWindow: noop,
    openWindow: noop,
    moveWindow: noop,
    resizeWindow: noop,
    minimizeWindow: noop,
    restoreWindow: noop,
    maximizeWindow: noop,
    restoreMaximizedWindow: noop,
    toggleMaximizeWindow: noop,
    closeWindow: noop,
    toggleTaskbarWindow: noop,
    switchDesktop: noop,
    toggleShowDesktop: noop,
    moveWindowToDesktop: noop,
    setWorkArea: noop,
  };
};

const command = (id: string, commandId = id): KMenuEntry => ({
  type: "command",
  id,
  label: id,
  iconId: "system",
  commandId,
  enabled: true,
});

const nestedEntries: readonly KMenuEntry[] = [{
  type: "submenu",
  id: "root-submenu",
  label: "All Applications",
  iconId: "system",
  enabled: true,
  children: [{
    type: "submenu",
    id: "nested-submenu",
    label: "Category",
    iconId: "system",
    enabled: true,
    children: [command("leaf-app", "leaf-app")],
  }],
}];

const createPointerEvent = (type: string, clientX = 10, clientY = 10) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: 1 },
    pointerType: { value: "touch" },
  });
  return event;
};

const renderPanel = (state: typeof initialKMenuState, onExecuteCommand = vi.fn()) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const onOpenSubmenu = vi.fn();
  const onCloseSubmenu = vi.fn();
  act(() => root?.render(
    <WindowManagerContext.Provider value={makeWindowManager()}>
      <I18nContext.Provider value={{ locale: "en", t: createTranslator("en") }}>
        <KMenuPanel
          menuId="k-menu-panel"
          entries={nestedEntries}
          state={state}
          onSetActiveItem={vi.fn()}
          onOpenSubmenu={onOpenSubmenu}
          onCloseSubmenu={onCloseSubmenu}
          onCloseMenu={vi.fn()}
          onLaunchApplication={vi.fn()}
          onExecuteCommand={onExecuteCommand}
        />
      </I18nContext.Provider>
    </WindowManagerContext.Provider>,
  ));
  return { onOpenSubmenu, onCloseSubmenu, onExecuteCommand };
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("mobile K Menu touch navigation", () => {
  it("dismisses outside pointerdown in capture phase so the underlying shell cannot click through", () => {
    const source = readFileSync("src/kicker/k-menu/KMenu.tsx", "utf8");

    expect(source).toContain('window.addEventListener("pointerdown", handlePointerDown, true)');
    expect(source).toContain('window.removeEventListener("pointerdown", handlePointerDown, true)');
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain("event.stopPropagation();");
  });

  it("adds a localized Back row only to a nested mobile submenu and returns one level", () => {
    const handlers = renderPanel({ ...initialKMenuState, isOpen: true, activeItemId: "leaf-app", openSubmenuId: "nested-submenu" });
    const back = container?.querySelector<HTMLButtonElement>('[data-k-menu-back="nested-submenu"]');

    expect(back?.textContent).toContain("Back");
    act(() => back?.click());

    expect(handlers.onCloseSubmenu).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenSubmenu).toHaveBeenCalledWith(expect.objectContaining({ id: "root-submenu" }));
  });

  it("executes a touch leaf once and ignores a touch scroll that moved beyond the tap tolerance", () => {
    const onExecuteCommand = vi.fn();
    renderPanel({ ...initialKMenuState, isOpen: true, activeItemId: "leaf-app", openSubmenuId: "nested-submenu" }, onExecuteCommand);
    const leaf = container?.querySelector<HTMLButtonElement>('[data-menu-item-id="leaf-app"]');
    if (!leaf) throw new Error("Missing touch leaf");

    act(() => leaf.dispatchEvent(createPointerEvent("pointerdown")));
    act(() => leaf.dispatchEvent(createPointerEvent("pointerup")));
    act(() => leaf.click());
    expect(onExecuteCommand).toHaveBeenCalledTimes(1);

    act(() => leaf.dispatchEvent(createPointerEvent("pointerdown", 10, 10)));
    act(() => leaf.dispatchEvent(createPointerEvent("pointermove", 30, 10)));
    act(() => leaf.dispatchEvent(createPointerEvent("pointerup", 30, 10)));
    act(() => leaf.click());
    expect(onExecuteCommand).toHaveBeenCalledTimes(1);
  });
});
