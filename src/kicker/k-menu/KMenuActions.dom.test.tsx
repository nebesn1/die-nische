// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialApplicationUsageState } from "../../application-runtime/applicationUsage";
import { ApplicationUsageContext } from "../../application-runtime/ApplicationUsageContext";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createKonquerorBookmark, getKonquerorBookmarkNode } from "../../apps/konqueror/bookmarks";
import { KonquerorBookmarksContext, type KonquerorBookmarksContextValue } from "../../apps/konqueror/konquerorBookmarksContext";
import { DesktopSessionContext, type DesktopSessionContextValue } from "../../desktop/desktopSessionContext";
import { createInitialVfsState } from "../../vfs/initialState";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { KMenu } from "./KMenu";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let reactRoot: Root | null = null;

afterEach(() => {
  act(() => reactRoot?.unmount());
  container?.remove();
  container = null;
  reactRoot = null;
});

const getButton = (id: string): HTMLButtonElement => {
  const button = container?.querySelector<HTMLButtonElement>(`[data-menu-item-id="${id}"]`);
  if (!button) throw new Error(`Missing menu item ${id}.`);
  return button;
};

const bookmark = createKonquerorBookmark({ name: "Documents", location: "/home/user/Documents" }, "bookmark-documents");

function renderMenu() {
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  const launchApplication = vi.fn(() => "opened" as const);
  const launchNewApplicationInstance = vi.fn(() => "opened" as const);
  const recordVisit = vi.fn();
  const lockSession = vi.fn();
  const openLogout = vi.fn();
  const vfs = { state: createInitialVfsState() } as VfsContextValue;
  const bookmarkContext = {
    bookmarks: { rootChildren: [bookmark] },
    persistenceStatus: { type: "ready" },
    getNode: (nodeId: string) => getKonquerorBookmarkNode({ rootChildren: [bookmark] }, nodeId),
    recordVisit,
  } as unknown as KonquerorBookmarksContextValue;
  const desktopSession = {
    isLocked: false,
    endSessionDialog: "closed",
    lockSession,
    openLogout,
  } as unknown as DesktopSessionContextValue;

  act(() => reactRoot?.render(
    <ApplicationUsageContext.Provider value={initialApplicationUsageState}>
      <ApplicationLauncherContext.Provider value={{
        launchApplication,
        launchNewApplicationInstance,
        launchUserApplication: launchApplication,
        launchNewUserApplicationInstance: launchNewApplicationInstance,
      }}>
        <VfsContext.Provider value={vfs}>
          <KonquerorBookmarksContext.Provider value={bookmarkContext}>
            <DesktopSessionContext.Provider value={desktopSession}><KMenu /></DesktopSessionContext.Provider>
          </KonquerorBookmarksContext.Provider>
        </VfsContext.Provider>
      </ApplicationLauncherContext.Provider>
    </ApplicationUsageContext.Provider>,
  ));

  const opener = container.querySelector<HTMLButtonElement>("[aria-controls=k-menu-panel]");
  if (!opener) throw new Error("K Menu opener is missing.");
  act(() => opener.click());
  return { launchApplication, launchNewApplicationInstance, recordVisit, lockSession, openLogout };
}

describe("K Menu Actions", () => {
  it("keeps direct Control Center while Settings retains only Configure the Panel", () => {
    const handlers = renderMenu();
    act(() => getButton("category-settings").click());

    expect(container?.querySelector('[data-menu-item-id="settings-control-center"]')).toBeNull();
    expect(getButton("settings-configure-panel").disabled).toBe(false);

    act(() => getButton("settings-configure-panel").click());
    expect(handlers.launchApplication).toHaveBeenCalledWith("configure-panel", undefined);

    act(() => container?.querySelector<HTMLButtonElement>("[aria-controls=k-menu-panel]")?.click());
    act(() => getButton("all-applications-control-center").click());
    expect(handlers.launchApplication).toHaveBeenCalledWith("kcontrol", undefined);
  });

  it("launches Configure the Panel through Settings as the singleton application identity", () => {
    const handlers = renderMenu();
    act(() => getButton("category-settings").click());
    act(() => getButton("settings-configure-panel").click());

    expect(handlers.launchApplication).toHaveBeenCalledWith("configure-panel", undefined);
  });

  it("opens shared Bookmark locations through the typed Konqueror bridge and records the stable bookmark id", () => {
    const handlers = renderMenu();
    act(() => getButton("action-bookmarks").click());
    act(() => getButton("bookmark-bookmark-documents").click());

    expect(handlers.launchNewApplicationInstance).toHaveBeenCalledWith("konqueror", {
      intent: { type: "open-directory", nodeId: "vfs-documents" },
    });
    expect(handlers.recordVisit).toHaveBeenCalledWith("bookmark-documents");
  });

  it("opens Quick Browser directory actions through the existing Konqueror and Konsole intents", () => {
    const handlers = renderMenu();
    act(() => getButton("action-quick-browser").click());
    act(() => getButton("quick-root-/home/user").click());
    act(() => getButton("quick-open-home:vfs-user").click());

    expect(handlers.launchNewApplicationInstance).toHaveBeenCalledWith("konqueror", {
      intent: { type: "open-directory", nodeId: "vfs-user" },
    });
  });

  it("keeps one correctly keyed Quick Browser submenu chain while moving through root home/user", () => {
    renderMenu();
    act(() => getButton("action-quick-browser").click());
    act(() => getButton("quick-root-/").click());
    act(() => getButton("quick-directory-root:vfs-root:vfs-home").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    act(() => getButton("quick-directory-root:vfs-root:vfs-home:vfs-user").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));

    const openSubmenus = [...(container?.querySelectorAll<HTMLElement>(".k-menu-submenu.is-positioned") ?? [])];
    expect(openSubmenus.map((submenu) => submenu.dataset.kMenuSubmenuId)).toEqual([
      "action-quick-browser",
      "quick-root-/",
      "quick-directory-root:vfs-root:vfs-home",
      "quick-directory-root:vfs-root:vfs-home:vfs-user",
    ]);
    expect(new Set(openSubmenus.map((submenu) => submenu.dataset.kMenuSubmenuId)).size).toBe(openSubmenus.length);
    expect(getButton("quick-open-root:vfs-root:vfs-home:vfs-user").getAttribute("data-menu-item-id")).toBe("quick-open-root:vfs-root:vfs-home:vfs-user");
  });

  it("anchors duplicate /home/user occurrences to their own menu rows", () => {
    const makeRect = (left: number, top: number, width = 100, height = 22): DOMRect => ({
      bottom: top + height,
      height,
      left,
      right: left + width,
      top,
      width,
      x: left,
      y: top,
      toJSON: () => ({}),
    } as DOMRect);

    renderMenu();
    act(() => getButton("action-quick-browser").click());
    const homeShortcut = getButton("quick-root-/home/user");
    vi.spyOn(homeShortcut, "getBoundingClientRect").mockReturnValue(makeRect(100, 120));
    act(() => homeShortcut.click());

    expect(container?.querySelector<HTMLElement>('[data-k-menu-submenu-id="quick-root-/home/user"]')?.style.left).toBe("199px");

    act(() => getButton("action-quick-browser").click());
    act(() => getButton("quick-root-/").click());
    act(() => getButton("quick-directory-root:vfs-root:vfs-home").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    const nestedUser = getButton("quick-directory-root:vfs-root:vfs-home:vfs-user");
    vi.spyOn(nestedUser, "getBoundingClientRect").mockReturnValue(makeRect(500, 180));
    act(() => nestedUser.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));

    expect(container?.querySelector<HTMLElement>('[data-k-menu-submenu-id="quick-directory-root:vfs-root:vfs-home:vfs-user"]')?.style.left).toBe("599px");
  });

  it("keeps the active cascade open when the pointer enters a child action row", () => {
    renderMenu();
    act(() => getButton("action-quick-browser").click());
    act(() => getButton("quick-root-/").click());
    act(() => getButton("quick-directory-root:vfs-root:vfs-home").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    const homeOpenAction = getButton("quick-open-root:vfs-root:vfs-home");
    act(() => homeOpenAction.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));

    expect(container?.querySelector('[data-k-menu-submenu-id="quick-directory-root:vfs-root:vfs-home"]')).not.toBeNull();
  });

  it("remeasures Quick Browser anchors after the parent menu list scrolls", async () => {
    let nestedUserTop = 180;
    const makeRect = (left: number, top: number, width = 100, height = 22): DOMRect => ({
      bottom: top + height,
      height,
      left,
      right: left + width,
      top,
      width,
      x: left,
      y: top,
      toJSON: () => ({}),
    } as DOMRect);

    renderMenu();
    act(() => getButton("action-quick-browser").click());
    act(() => getButton("quick-root-/").click());
    act(() => getButton("quick-directory-root:vfs-root:vfs-home").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    const nestedUser = getButton("quick-directory-root:vfs-root:vfs-home:vfs-user");
    vi.spyOn(nestedUser, "getBoundingClientRect").mockImplementation(() => makeRect(500, nestedUserTop));
    act(() => nestedUser.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    await act(async () => undefined);

    const submenu = container?.querySelector<HTMLElement>('[data-k-menu-submenu-id="quick-directory-root:vfs-root:vfs-home:vfs-user"]');
    const list = container?.querySelector<HTMLElement>(".k-menu-list");
    if (!submenu || !list) throw new Error("Quick Browser submenu or parent list is missing.");
    expect(submenu.style.top).toBe("180px");

    nestedUserTop = 320;
    act(() => list.dispatchEvent(new Event("scroll")));
    expect(submenu.style.top).toBe("320px");
  });

  it("closes an obsolete Quick Browser sibling branch before opening the next one", () => {
    renderMenu();
    act(() => getButton("action-quick-browser").click());
    act(() => getButton("quick-root-/").click());
    act(() => getButton("quick-directory-root:vfs-root:vfs-home").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    act(() => getButton("quick-directory-root:vfs-root:vfs-home:vfs-user").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    act(() => getButton("quick-directory-root:vfs-root:vfs-home:vfs-user:vfs-documents").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(container?.querySelector('[data-k-menu-submenu-id="quick-directory-root:vfs-root:vfs-home:vfs-user:vfs-documents"]')).not.toBeNull();

    act(() => getButton("quick-directory-root:vfs-root:vfs-home:vfs-user:vfs-pictures").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(container?.querySelector('[data-k-menu-submenu-id="quick-directory-root:vfs-root:vfs-home:vfs-user:vfs-documents"]')).toBeNull();
    expect(container?.querySelector('[data-k-menu-submenu-id="quick-directory-root:vfs-root:vfs-home:vfs-user:vfs-pictures"]')).not.toBeNull();
  });

  it("uses the same Run Command dialog for the menu row and Alt+F2", () => {
    renderMenu();
    act(() => getButton("command-run").click());
    expect(container?.querySelectorAll("[aria-label='Run Command']")).toHaveLength(1);
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { altKey: true, key: "F2" })));
    expect(container?.querySelectorAll("[aria-label='Run Command']")).toHaveLength(1);
  });

  it("routes Lock Session and Logout to the existing Desktop session authority", () => {
    const lockHandlers = renderMenu();
    act(() => getButton("command-lock-screen").click());
    expect(lockHandlers.lockSession).toHaveBeenCalledTimes(1);

    act(() => reactRoot?.unmount());
    container?.remove();
    container = null;
    reactRoot = null;

    const logoutHandlers = renderMenu();
    act(() => getButton("command-logout").click());
    expect(logoutHandlers.openLogout).toHaveBeenCalledTimes(1);
  });
});
