// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationUsageContext } from "../../application-runtime/ApplicationUsageContext";
import { initialApplicationUsageState, recordApplicationUse } from "../../application-runtime/applicationUsage";
import type { LaunchApplicationOptions } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { I18nContext } from "../../i18n/I18nContext";
import { createTranslator } from "../../i18n/translate";
import type { DesktopLocale } from "../../i18n/locale";
import type { WindowLayoutMode } from "../../window-manager/types";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { KMenu } from "./KMenu";
import { KMenuPanel } from "./KMenuPanel";
import { initialKMenuState } from "./menuState";
import { getKMenuPopupGeometry } from "./popupGeometry";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let reactRoot: Root | null = null;

afterEach(() => {
  act(() => reactRoot?.unmount());
  container?.remove();
  container = null;
  reactRoot = null;
});

function renderMenu(activeItemId: string, openSubmenuId: string | null = null) {
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  const onLaunchApplication = vi.fn();
  const onLaunchNewApplicationInstance = vi.fn();
  const onOpenSubmenu = vi.fn();
  const onCloseMenu = vi.fn();

  act(() => reactRoot?.render(
    <KMenuPanel
      menuId="k-menu-panel"
      state={{ ...initialKMenuState, isOpen: true, activeItemId, openSubmenuId }}
      onSetActiveItem={() => undefined}
      onOpenSubmenu={onOpenSubmenu}
      onCloseSubmenu={() => undefined}
      onCloseMenu={onCloseMenu}
      onLaunchApplication={onLaunchApplication}
      onLaunchNewApplicationInstance={onLaunchNewApplicationInstance}
    />,
  ));

  return { onCloseMenu, onLaunchApplication, onLaunchNewApplicationInstance, onOpenSubmenu };
}

function button(id: string): HTMLButtonElement {
  const element = container?.querySelector<HTMLButtonElement>(`[data-menu-item-id="${id}"]`);
  if (!element) throw new Error(`Missing K Menu item ${id}`);
  return element;
}

function createMenuWindowManager(layoutMode: WindowLayoutMode): WindowManagerContextValue {
  const noop = vi.fn();

  return {
    windows: [],
    currentDesktopId: 1,
    desktopCount: 4,
    lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null },
    showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
    workArea: { x: 0, y: 0, width: 1024, height: 700, titleBarHeight: 22 },
    screenArea: { x: 0, y: 0, width: 1024, height: 746 },
    layoutMode,
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
}

function renderInteractiveMenu(
  usage = initialApplicationUsageState,
  locale: DesktopLocale = "en",
  layoutMode?: WindowLayoutMode,
) {
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  const launchApplication = vi.fn();
  const launchNewApplicationInstance = vi.fn();

  const menu = (
    <I18nContext.Provider value={{ locale, t: createTranslator(locale) }}>
      <ApplicationUsageContext.Provider value={usage}>
        <ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance }}>
          <KMenu />
        </ApplicationLauncherContext.Provider>
      </ApplicationUsageContext.Provider>
    </I18nContext.Provider>
  );

  act(() => reactRoot?.render(
    layoutMode === undefined
      ? menu
      : <WindowManagerContext.Provider value={createMenuWindowManager(layoutMode)}>{menu}</WindowManagerContext.Provider>,
  ));

  return { launchApplication, launchNewApplicationInstance };
}

function menuPanel(): HTMLElement {
  const element = container?.querySelector<HTMLElement>("#k-menu-panel");
  if (!element) throw new Error("K Menu panel is not open.");
  return element;
}

function openInteractiveMenu(): void {
  const opener = container?.querySelector<HTMLButtonElement>('[aria-controls="k-menu-panel"]');
  if (!opener) throw new Error("K Menu opener is missing.");
  act(() => opener.click());
}

describe("K Menu interaction", () => {
  it("keeps the popup bottom above the Kicker and contains 0/1/4 Most Used rows at every scale", () => {
    [1, 1.4, 2].forEach((scale) => {
      const logicalViewportHeight = 900;
      const logicalKickerTop = logicalViewportHeight - 46;
      [0, 1, 4].forEach((mostUsedCount) => {
        const naturalHeight = 310 + mostUsedCount * 22;
        const physicalGeometry = getKMenuPopupGeometry({
          viewportHeight: logicalViewportHeight * scale,
          kickerTop: logicalKickerTop * scale,
          naturalHeight: naturalHeight * scale,
        });
        const geometry = getKMenuPopupGeometry({
          viewportHeight: physicalGeometry.bottom / scale,
          kickerTop: physicalGeometry.bottom / scale,
          naturalHeight: physicalGeometry.height / scale,
        });

        expect(geometry.bottom).toBe(logicalKickerTop);
        expect(geometry.top).toBe(logicalKickerTop - naturalHeight);
        expect(geometry.height).toBe(naturalHeight);
        expect(geometry.needsScroll).toBe(false);
      });
    });

    expect(getKMenuPopupGeometry({ viewportHeight: 600, kickerTop: 560, naturalHeight: 800 })).toEqual({
      top: 0,
      bottom: 560,
      height: 560,
      needsScroll: true,
    });

    [900, 600, 450].forEach((browserCssViewportHeight) => {
      const logicalViewportHeight = browserCssViewportHeight / 1.4;
      const logicalKickerTop = logicalViewportHeight - 46;
      const geometry = getKMenuPopupGeometry({
        viewportHeight: logicalViewportHeight,
        kickerTop: logicalKickerTop,
        naturalHeight: 900,
      });

      expect(geometry.top).toBeCloseTo(0);
      expect(geometry.bottom).toBeCloseTo(logicalKickerTop);
      expect(geometry.height).toBeLessThanOrEqual(logicalKickerTop);
      expect(geometry.needsScroll).toBe(true);
    });
  });

  it("renders core shell labels through the shared runtime locale", () => {
    renderInteractiveMenu(initialApplicationUsageState, "zh-CN");
    openInteractiveMenu();

    expect(button("category-editors").textContent).toContain("编辑器");
    expect(button("command-run").textContent).toContain("运行命令");
    expect(menuPanel().getAttribute("aria-label")).toBe("K 菜单");
  });

  it("keeps long K Menu action labels in the German runtime locale", () => {
    renderInteractiveMenu(initialApplicationUsageState, "de");
    openInteractiveMenu();

    expect(button("command-run").textContent).toContain("Befehl ausführen");
    expect(button("category-settings").textContent).toContain("Einstellungen");
    expect(menuPanel().getAttribute("aria-label")).toBe("K-Menü");
  });

  it("opens with no selection, waits for explicit keyboard navigation, and resets on reopen", () => {
    const handlers = renderInteractiveMenu();
    openInteractiveMenu();

    const first = button("category-editors");
    expect(first.classList.contains("is-active")).toBe(false);
    expect(first.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(menuPanel());

    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })));
    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })));
    expect(handlers.launchApplication).not.toHaveBeenCalled();
    expect(handlers.launchNewApplicationInstance).not.toHaveBeenCalled();
    expect(container?.querySelector('[data-menu-item-id="app-kwrite"]')).toBeNull();

    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })));
    expect(first.classList.contains("is-active")).toBe(true);

    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Home" })));
    expect(first.classList.contains("is-active")).toBe(true);
    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "End" })));
    expect(button("command-logout").classList.contains("is-active")).toBe(true);

    openInteractiveMenu();
    openInteractiveMenu();
    expect(button("category-editors").classList.contains("is-active")).toBe(false);
  });

  it("selects the final enabled row with ArrowUp from no selection and follows pointer hover", () => {
    renderInteractiveMenu();
    openInteractiveMenu();

    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" })));
    expect(button("command-logout").classList.contains("is-active")).toBe(true);

    openInteractiveMenu();
    openInteractiveMenu();
    act(() => button("category-editors").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(button("category-editors").classList.contains("is-active")).toBe(true);
    act(() => button("common-find-files").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(button("common-find-files").classList.contains("is-active")).toBe(true);
  });

  it("keeps populated Most Used unselected until ArrowDown selects its first application", () => {
    renderInteractiveMenu(recordApplicationUse(initialApplicationUsageState, "konqueror"));
    openInteractiveMenu();

    const mostUsed = button("most-used-konqueror");
    expect(mostUsed.textContent).toContain("Web Browser (Konqueror)");
    expect(mostUsed.classList.contains("is-active")).toBe(false);

    act(() => menuPanel().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })));
    expect(mostUsed.classList.contains("is-active")).toBe(true);
  });

  it("applies the mobile unsupported policy to the live K Menu without changing entry identity", () => {
    let usage = initialApplicationUsageState;
    ["kcalc", "kfind", "configure-panel"].forEach((appId) => {
      usage = recordApplicationUse(usage, appId);
    });

    renderInteractiveMenu(usage, "en", "mobile");
    openInteractiveMenu();

    ["common-find-files", "action-bookmarks", "action-quick-browser", "command-run", "most-used-kcalc"].forEach((id) => {
      expect(button(id).disabled).toBe(true);
      expect(button(id).getAttribute("aria-disabled")).toBe("true");
    });

    act(() => button("action-bookmarks").click());
    expect(container?.querySelector('[data-menu-item-id="bookmark-empty"]')).toBeNull();

    act(() => button("category-settings").click());
    expect(button("settings-configure-panel").disabled).toBe(true);

    act(() => button("category-utilities").click());
    expect(button("app-kcalc").disabled).toBe(true);
  });

  it("renders only the four highest-ranked eligible Most Used rows before All Applications", () => {
    let usage = initialApplicationUsageState;
    ["kwrite", "konqueror", "konsole", "kcalc", "kcontrol"].forEach((appId) => {
      usage = recordApplicationUse(usage, appId);
    });

    renderInteractiveMenu(usage);
    openInteractiveMenu();

    const mostUsedRows = [...(container?.querySelectorAll<HTMLElement>('[data-menu-item-id^="most-used-"]') ?? [])];
    expect(mostUsedRows).toHaveLength(4);
    expect(mostUsedRows.map((row) => row.getAttribute("data-menu-item-id"))).toEqual([
      "most-used-kcontrol",
      "most-used-kcalc",
      "most-used-konsole",
      "most-used-konqueror",
    ]);
    expect(container?.querySelector('[data-menu-item-id="most-used-kwrite"]')).toBeNull();
    const markup = container?.innerHTML ?? "";
    expect(markup.indexOf('data-menu-section-id="section-most-used"')).toBeLessThan(markup.indexOf('data-menu-section-id="section-all-applications"'));
    expect(markup.indexOf('data-menu-item-id="most-used-konqueror"')).toBeLessThan(markup.indexOf('data-menu-section-id="section-all-applications"'));
  });

  it("opens and reopens the scrollable list at the first row", () => {
    let usage = initialApplicationUsageState;
    ["kwrite", "konqueror", "konsole", "kcalc"].forEach((appId) => {
      usage = recordApplicationUse(usage, appId);
    });

    renderInteractiveMenu(usage);
    openInteractiveMenu();
    const list = container?.querySelector<HTMLElement>(".k-menu-list");
    if (!list) throw new Error("K Menu list is missing.");

    expect(list.scrollTop).toBe(0);
    expect(list.querySelector('[data-menu-section-id="section-most-used"]')).not.toBeNull();
    expect(list.querySelector('[data-menu-item-id="command-logout"]')).not.toBeNull();
    list.scrollTop = 120;
    act(() => container?.querySelector<HTMLButtonElement>('[aria-controls="k-menu-panel"]')?.click());
    openInteractiveMenu();

    const reopenedList = container?.querySelector<HTMLElement>(".k-menu-list");
    if (!reopenedList) throw new Error("Reopened K Menu list is missing.");
    expect(reopenedList.scrollTop).toBe(0);
  });

  it("maps the required K Menu feature entries to their semantic presentation icons", () => {
    renderMenu("category-settings");
    const requiredIconIds = [
      ["category-settings", "kmenu-settings"],
      ["category-system", "kmenu-system"],
      ["category-utilities", "kmenu-utilities"],
      ["all-applications-control-center", "kmenu-control-center"],
      ["common-find-files", "kmenu-find-files"],
      ["common-help", "kmenu-help"],
      ["command-logout", "kmenu-logout"],
      ["category-internet", "internet"],
      ["action-quick-browser", "kmenu-quick-browser"],
    ] as const;

    const renderedIconIds = requiredIconIds.map(([entryId]) => {
      const icon = button(entryId).querySelector<HTMLElement>("[data-k-menu-icon-id]");
      expect(icon).not.toBeNull();
      return icon?.getAttribute("data-k-menu-icon-id");
    });

    expect(renderedIconIds).toEqual(requiredIconIds.map(([, iconId]) => iconId));
    expect(new Set(renderedIconIds).size).toBe(requiredIconIds.length);
  });

  it("opens enabled runtime-owned action submenus without treating them as application launches", () => {
    const handlers = renderMenu("action-bookmarks");
    const bookmarks = button("action-bookmarks");

    expect(bookmarks.getAttribute("aria-disabled")).toBeNull();
    act(() => bookmarks.click());

    expect(handlers.onOpenSubmenu).toHaveBeenCalledWith(expect.objectContaining({ id: "action-bookmarks", type: "submenu" }));
    expect(handlers.onLaunchApplication).not.toHaveBeenCalled();
    expect(handlers.onLaunchNewApplicationInstance).not.toHaveBeenCalled();
    expect(handlers.onCloseMenu).not.toHaveBeenCalled();
  });

  it("keeps mobile-unsupported rows visible but semantically non-activatable", () => {
    const onExecuteCommand = vi.fn();
    const onOpenSubmenu = vi.fn();
    const entries = [
      { type: "application", id: "mobile-app", label: "Mobile App", iconId: "kcalc", appId: "kcalc", enabled: false },
      { type: "submenu", id: "mobile-submenu", label: "Mobile Submenu", iconId: "bookmark", enabled: false, children: [
        { type: "command", id: "hidden-child", label: "Hidden Child", iconId: "system", commandId: "hidden", enabled: true },
      ] },
      { type: "command", id: "mobile-command", label: "Mobile Command", iconId: "run-command", commandId: "run-command", enabled: false },
    ] as const;

    container = document.createElement("div");
    document.body.append(container);
    reactRoot = createRoot(container);

    act(() => reactRoot?.render(
      <KMenuPanel
        menuId="k-menu-panel"
        entries={entries}
        state={{ ...initialKMenuState, isOpen: true, activeItemId: "mobile-submenu", openSubmenuId: "mobile-submenu" }}
        onSetActiveItem={() => undefined}
        onOpenSubmenu={onOpenSubmenu}
        onCloseSubmenu={() => undefined}
        onCloseMenu={() => undefined}
        onLaunchApplication={() => undefined}
        onExecuteCommand={onExecuteCommand}
      />
    ));

    const disabledRows = [button("mobile-app"), button("mobile-submenu"), button("mobile-command")];
    disabledRows.forEach((row) => {
      expect(row.disabled).toBe(true);
      expect(row.getAttribute("aria-disabled")).toBe("true");
      act(() => row.click());
    });

    expect(onOpenSubmenu).not.toHaveBeenCalled();
    expect(onExecuteCommand).not.toHaveBeenCalled();
    expect(container.querySelector("[data-menu-item-id=hidden-child]")).toBeNull();
  });

  it("marks an opened cascade as measured before making it interactive", async () => {
    renderMenu("category-internet", "category-internet");
    await act(async () => undefined);

    const submenu = container?.querySelector<HTMLElement>("[data-k-menu-submenu-id=category-internet]");
    if (!submenu) throw new Error("K Menu submenu is missing.");

    expect(submenu.classList.contains("is-positioned")).toBe(true);
    expect(submenu.style.left).not.toBe("");
    expect(submenu.style.top).not.toBe("");
  });

  it("launches the existing KFind and Home runtime targets through the normal menu dispatcher", () => {
    const findHandlers = renderMenu("common-find-files");
    act(() => button("common-find-files").click());

    expect(findHandlers.onLaunchNewApplicationInstance).toHaveBeenCalledWith("kfind", undefined);
    expect(findHandlers.onCloseMenu).toHaveBeenCalledWith(false);

    act(() => reactRoot?.unmount());
    container?.remove();
    container = null;
    reactRoot = null;

    const homeHandlers = renderMenu("common-home");
    act(() => button("common-home").click());

    expect(homeHandlers.onLaunchNewApplicationInstance).toHaveBeenCalledWith("konqueror", {
      intent: { type: "open-special-location", location: "home" },
    } satisfies LaunchApplicationOptions);
    expect(homeHandlers.onCloseMenu).toHaveBeenCalledWith(false);
  });
});
