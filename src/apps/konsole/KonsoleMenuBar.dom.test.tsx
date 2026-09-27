// @vitest-environment jsdom
import { StrictMode, act, useContext, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopSessionContext, type DesktopSessionContextValue } from "../../desktop/desktopSessionContext";
import { WindowOwnedPopupLayer } from "../../desktop/WindowOwnedPopupLayer";
import type { DesktopWindow } from "../../window-manager/types";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { VfsProvider } from "../../vfs/VfsProvider";
import { Konsole } from "./Konsole";
import { KonsoleBookmarksProvider } from "./KonsoleBookmarksContext";
import { KonsoleBookmarksContext } from "./konsoleBookmarksContext";
import type { KonquerorBookmarkTree } from "../konqueror/bookmarks";

let container: HTMLDivElement;
let reactRoot: Root;
let windowManager: WindowManagerContextValue;

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  width,
  height,
  top,
  right: left + width,
  bottom: top + height,
  left,
  toJSON: () => ({}),
}) as DOMRect;

const createWindow = (id = "app:konsole", isActive = true): DesktopWindow => ({
  id,
  appId: "konsole",
  title: id === "app:konsole" ? "Konsole" : "Konsole<2>",
  iconId: "konsole",
  desktopId: 1,
  bounds: { x: 30, y: 30, width: 700, height: 460 },
  zIndex: isActive ? 2 : 1,
  isActive,
  state: "normal",
  isDraggable: true,
  minimumWidth: 420,
  minimumHeight: 260,
  isResizable: true,
});

const createWindowManager = (windows: readonly DesktopWindow[]): WindowManagerContextValue => ({
  windows,
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
});

function ClipboardHarness({ children, initialText = null }: { readonly children: ReactNode; readonly initialText?: string | null }) {
  const [text, setText] = useState<string | null>(initialText);
  const value = useMemo<DesktopSessionContextValue>(() => ({
    isLocked: false,
    endSessionDialog: "closed",
    isClipboardOpen: false,
    clipboardHistory: text === null ? [] : [text],
    currentClipboardText: text,
    hasClipboardText: text !== null && text.length > 0,
    clipboardStatus: null,
    selectionCaptureGeneration: 0,
    resetGeneration: 0,
    lockSession: () => undefined,
    unlockSession: () => undefined,
    openEndSession: () => undefined,
    requestEndSession: () => undefined,
    returnToEndSessionOptions: () => undefined,
    closeEndSession: () => undefined,
    confirmEndSession: () => undefined,
    toggleClipboard: () => undefined,
    closeClipboard: () => undefined,
    recordClipboardText: (nextText) => setText(nextText),
    readClipboardText: () => text,
    writeClipboard: async (nextText) => setText(nextText),
    clearClipboardHistory: () => undefined,
  }), [text]);

  return <DesktopSessionContext.Provider value={value}>{children}</DesktopSessionContext.Provider>;
}

const renderKonsoles = (
  windows: readonly DesktopWindow[],
  options: {
    readonly clipboardText?: string | null;
    readonly onNewWindow?: () => void;
    readonly onQuit?: (windowId: string) => void;
    readonly onSetWindowTitle?: (title: string) => void;
    readonly bookmarks?: KonquerorBookmarkTree;
    readonly onEditBookmarks?: () => void;
    readonly onAbout?: (windowId: string, appId: "about-konsole" | "about-kde") => void;
  } = {},
) => {
  windowManager = createWindowManager(windows);
  act(() => {
    reactRoot.render(
      <WindowManagerContext.Provider value={windowManager}>
        <ClipboardHarness initialText={options.clipboardText}>
          <VfsProvider>
            <KonsoleBookmarksProvider initialBookmarks={options.bookmarks} createNodeId={() => "created-bookmark"} now={() => "2026-09-11T00:00:00.000Z"}>
              <StrictMode>
                {windows.map((desktopWindow) => (
                  <WindowOwnedPopupLayer key={desktopWindow.id} desktopWindow={desktopWindow}>
                    <Konsole
                      windowId={desktopWindow.id}
                      onRequestNewWindow={options.onNewWindow}
                      onRequestClose={() => options.onQuit?.(desktopWindow.id)}
                      onSetWindowTitle={options.onSetWindowTitle}
                      onRequestEditBookmarks={options.onEditBookmarks}
                      onRequestAbout={(appId) => options.onAbout?.(desktopWindow.id, appId)}
                    />
                  </WindowOwnedPopupLayer>
                ))}
                <BookmarkVisitProbe />
              </StrictMode>
            </KonsoleBookmarksProvider>
          </VfsProvider>
        </ClipboardHarness>
      </WindowManagerContext.Provider>,
    );
  });
};

function BookmarkVisitProbe() {
  const { bookmarks } = useContext(KonsoleBookmarksContext);
  const findFirstBookmark = (nodes: typeof bookmarks.rootChildren): Extract<typeof nodes[number], { type: "bookmark" }> | null => {
    for (const node of nodes) {
      if (node.type === "bookmark") return node;
      const nested = findFirstBookmark(node.children);
      if (nested) return nested;
    }
    return null;
  };
  const first = findFirstBookmark(bookmarks.rootChildren);
  return <output data-testid="konsole-bookmark-visits">{first?.type === "bookmark" ? first.visitCount : ""}</output>;
}

const root = (windowId = "app:konsole") => {
  const element = container.querySelector<HTMLElement>(`[data-konsole-root='true'][data-window-id='${windowId}']`);
  if (!element) throw new Error(`Missing Konsole root ${windowId}`);
  return element;
};

const button = (scope: ParentNode, label: string) => {
  const element = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.replace("▶", "") === label,
  );
  if (!element) throw new Error(`Missing button ${label}`);
  return element;
};

const click = (scope: ParentNode, label: string) => act(() => button(scope, label).click());

const menu = (label: string) => {
  const element = container.querySelector<HTMLElement>(`[aria-label='${label} menu']`);
  if (!element) throw new Error(`Missing ${label} menu`);
  return element;
};

const commandInput = (windowId = "app:konsole") => {
  const input = root(windowId).querySelector<HTMLInputElement>("[aria-label='Konsole command input']");
  if (!input) throw new Error("Missing Konsole command input");
  return input;
};

const changeInput = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Missing input value setter");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("konsole-schema-menu")) return rect(0, 0, 144, 110);
    if (this.classList.contains("konsole-menu-popup")) return rect(0, 0, 122, 68);
    if (this.classList.contains("konsole-menuitem")) {
      if (this.textContent === "Settings") return rect(860, 600, 48, 20);
      return rect(30, 40, 42, 20);
    }
    if (this.dataset.konsoleMenuCommand === "schema") return rect(840, 610, 112, 20);
    return rect(0, 0, 0, 0);
  });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Konsole window-owned menu bar", () => {
  it("renders exactly Session, Edit, View, Bookmarks, Settings, and Help", () => {
    renderKonsoles([createWindow()]);
    const menuBar = root().querySelector<HTMLElement>("[aria-label='Konsole menu bar']");

    expect([...menuBar?.querySelectorAll<HTMLButtonElement>("button") ?? []].map((item) => item.textContent)).toEqual([
      "Session", "Edit", "View", "Bookmarks", "Settings", "Help",
    ]);
  });

  it("uses owner-scoped, measured Session and Schema popups with a flipped submenu", () => {
    renderKonsoles([createWindow()]);
    click(root(), "Session");
    const sessionMenu = menu("Session");

    expect(sessionMenu.parentElement?.dataset.windowId).toBe("app:konsole");
    expect(sessionMenu.dataset.positioned).toBe("true");
    expect([...sessionMenu.querySelectorAll<HTMLButtonElement>("button")].map((item) => item.textContent)).toEqual(["New Shell", "New Window", "Quit"]);
    expect(sessionMenu.querySelectorAll("[role='separator']")).toHaveLength(1);

    click(root(), "Settings");
    click(menu("Settings"), "Schema");
    const schemaMenu = menu("Schema");

    expect(schemaMenu.parentElement?.dataset.windowId).toBe("app:konsole");
    expect(schemaMenu.dataset.positioned).toBe("true");
    expect(schemaMenu.style.left).toBe("698px");
    expect(schemaMenu.querySelector("[data-konsole-schema='konsole-default']")?.getAttribute("aria-checked")).toBe("true");
  });

  it("opens saved bookmarks through the active shell command pipeline and records a visit", () => {
    renderKonsoles([createWindow()], {
      bookmarks: { rootChildren: [{ id: "documents", type: "bookmark", name: "Documents", location: "/home/user/Documents/", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 }] },
    });

    click(root(), "Bookmarks");
    click(menu("Bookmarks"), "Documents");

    expect(root().querySelector("[role='log']")?.textContent).toContain("cd '/home/user/Documents/'");
    expect(root().textContent).toContain("user@kde3:/home/user/Documents$");
    expect(container.querySelector("[data-testid='konsole-bookmark-visits']")?.textContent).toBe("1");
    expect(container.querySelector("[aria-label='Bookmarks menu']")).toBeNull();

    click(root(), "Bookmarks");
    click(menu("Bookmarks"), "Documents");
    expect(container.querySelector("[data-testid='konsole-bookmark-visits']")?.textContent).toBe("2");
  });

  it("does not record a visit when the shell rejects a stale or invalid bookmark path", () => {
    renderKonsoles([createWindow()], {
      bookmarks: { rootChildren: [{ id: "missing", type: "bookmark", name: "Missing", location: "/home/user/No Such Directory/", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 }] },
    });

    click(root(), "Bookmarks");
    click(menu("Bookmarks"), "Missing");

    expect(root().querySelector("[role='log']")?.textContent).toContain("cd '/home/user/No Such Directory/'");
    expect(root().textContent).toContain("no such file or directory");
    expect(container.querySelector("[data-testid='konsole-bookmark-visits']")?.textContent).toBe("0");
  });

  it("keeps recursive folders, folder commands, and active-window bookmark opening isolated", () => {
    const onEditBookmarks = vi.fn();
    renderKonsoles([createWindow("app:konsole", true), createWindow("app:konsole::2", false)], {
      onEditBookmarks,
      bookmarks: { rootChildren: [{ id: "work", type: "folder", name: "Work", children: [{ id: "docs", type: "bookmark", name: "Docs", location: "/home/user/Documents/", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 }] }] },
    });

    click(root("app:konsole::2"), "Bookmarks");
    const bookmarksMenu = menu("Bookmarks");
    click(bookmarksMenu, "Work");
    const workMenu = container.querySelector<HTMLElement>("[aria-label='Work bookmarks']");
    if (!workMenu) throw new Error("Missing Work bookmarks menu");
    expect([...workMenu.querySelectorAll<HTMLButtonElement>("button")].map((item) => item.textContent)).toEqual(["Docs", "Add Bookmark", "New Bookmark Folder..."]);
    expect(workMenu.querySelectorAll("[role='separator']")).toHaveLength(1);
    click(workMenu, "Docs");

    expect(root("app:konsole::2").textContent).toContain("user@kde3:/home/user/Documents$");
    expect(root("app:konsole").textContent).toContain("user@kde3:/home/user$");
    expect(root("app:konsole").textContent).not.toContain("cd '/home/user/Documents/'");
    expect(container.querySelector("[data-testid='konsole-bookmark-visits']")?.textContent).toBe("1");

    click(root("app:konsole"), "Bookmarks");
    click(menu("Bookmarks"), "Edit Bookmarks");
    expect(onEditBookmarks).toHaveBeenCalledOnce();
  });

  it("keeps long bookmark paths and folder commands in one content-sized menu row", () => {
    renderKonsoles([createWindow()], {
      bookmarks: {
        rootChildren: [
          { id: "root-path", type: "bookmark", name: "/home/user/Documents/Projects/Test/", location: "/home/user/Documents/Projects/Test/", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
          {
            id: "aa",
            type: "folder",
            name: "AA",
            children: [
              { id: "nested-path", type: "bookmark", name: "/home/user/Documents/", location: "/home/user/Documents/", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
              { id: "bb", type: "folder", name: "BB", children: [] },
            ],
          },
        ],
      },
    });

    click(root(), "Bookmarks");
    const bookmarksMenu = menu("Bookmarks");
    expect([...bookmarksMenu.querySelectorAll<HTMLButtonElement>("button")].map((item) => item.textContent)).toEqual([
      "Add Bookmark", "Edit Bookmarks", "New Bookmark Folder...", "/home/user/Documents/Projects/Test/", "AA▶",
    ]);
    expect(bookmarksMenu.classList).toContain("konsole-menu-popup--bookmarks");

    click(bookmarksMenu, "AA");
    const aaMenu = container.querySelector<HTMLElement>("[aria-label='AA bookmarks']");
    if (!aaMenu) throw new Error("Missing AA bookmarks menu");
    expect([...aaMenu.querySelectorAll<HTMLButtonElement>("button")].map((item) => item.textContent)).toEqual([
      "/home/user/Documents/", "BB▶", "Add Bookmark", "New Bookmark Folder...",
    ]);
    expect(aaMenu.querySelectorAll("[role='separator']")).toHaveLength(1);
    expect(aaMenu.classList).toContain("konsole-bookmark-menu__submenu");
  });

  it("uses explicit new-instance and exact-window quit callbacks", () => {
    const newWindow = vi.fn();
    const quit = vi.fn();
    renderKonsoles([createWindow("app:konsole", true), createWindow("app:konsole::2", false)], { onNewWindow: newWindow, onQuit: quit });

    click(root("app:konsole"), "Session");
    click(menu("Session"), "New Window");
    expect(newWindow).toHaveBeenCalledOnce();
    expect(root("app:konsole").querySelectorAll("[role='tab']")).toHaveLength(1);

    click(root("app:konsole::2"), "Session");
    click(menu("Session"), "Quit");
    expect(quit).toHaveBeenCalledWith("app:konsole::2");
  });

  it("uses the exact-window shared New Shell authority without launching a window", () => {
    const newWindow = vi.fn();
    renderKonsoles([createWindow()], { onNewWindow: newWindow });

    click(root(), "Session");
    click(menu("Session"), "New Shell");

    expect([...root().querySelectorAll("[role='tab']")].map((tab) => tab.textContent)).toEqual(["Shell", "Shell No. 2"]);
    expect(root().querySelector("[role='tab'][aria-selected='true']")?.textContent).toBe("Shell No. 2");
    expect(newWindow).not.toHaveBeenCalled();
    expect(container.querySelector("[aria-label='Session menu']")).toBeNull();

    click(root(), "Session");
    click(menu("Session"), "New Shell");
    act(() => [...root().querySelectorAll<HTMLButtonElement>("[role='tab']")].find((tab) => tab.textContent === "Shell No. 2")?.click());
    act(() => root().querySelector<HTMLButtonElement>("[aria-label='Close Shell']")?.click());
    click(root(), "Session");
    click(menu("Session"), "New Shell");
    expect(root().querySelector("[role='tab'][aria-selected='true']")?.textContent).toBe("Shell No. 2");
  });

  it("routes View Rename Session to the current active shell through the existing dialog", () => {
    const setTitle = vi.fn();
    renderKonsoles([createWindow()], { onSetWindowTitle: setTitle });
    click(root(), "Session");
    click(menu("Session"), "New Shell");

    click(root(), "View");
    const viewMenu = menu("View");
    expect([...viewMenu.querySelectorAll<HTMLButtonElement>("button")].map((item) => item.textContent)).toEqual(["Rename Session"]);
    click(viewMenu, "Rename Session");

    const nameInput = root().querySelector<HTMLInputElement>("[aria-label='Shell name']");
    expect(nameInput?.value).toBe("Shell No. 2");
    if (!nameInput) throw new Error("Missing rename input");
    changeInput(nameInput, "Build");
    click(root(), "OK");

    expect(root().querySelector("[role='tab'][aria-selected='true']")?.textContent).toBe("Build");
    expect(setTitle).toHaveBeenLastCalledWith("user@kde3:/home/user - Build - Konsole");
  });

  it("keeps New Shell and Rename Session exact-window local", () => {
    renderKonsoles([createWindow("app:konsole", true), createWindow("app:konsole::2", false)]);

    click(root("app:konsole"), "Session");
    click(menu("Session"), "New Shell");
    expect(root("app:konsole").querySelectorAll("[role='tab']")).toHaveLength(2);
    expect(root("app:konsole::2").querySelectorAll("[role='tab']")).toHaveLength(1);

    click(root("app:konsole"), "View");
    click(menu("View"), "Rename Session");
    expect(root("app:konsole").querySelector("[aria-label='Shell name']")).not.toBeNull();
    expect(root("app:konsole::2").querySelector("[aria-label='Shell name']")).toBeNull();
  });

  it("copies selected terminal input to the shared clipboard and pastes it at the caret without executing", async () => {
    renderKonsoles([createWindow()], { clipboardText: "XYZ" });
    const input = commandInput();
    changeInput(input, "abcdef");
    act(() => {
      input.focus();
      input.setSelectionRange(1, 4);
      input.dispatchEvent(new Event("select", { bubbles: true }));
      input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    click(root(), "Edit");
    expect(button(menu("Edit"), "Copy").disabled).toBe(false);
    click(menu("Edit"), "Copy");

    await act(async () => { await Promise.resolve(); });
    click(root(), "Edit");
    expect(button(menu("Edit"), "Paste").disabled).toBe(false);
    act(() => input.setSelectionRange(3, 3));
    click(menu("Edit"), "Paste");

    expect(commandInput().value).toBe("abcbcddef");
    expect(root().querySelector("[role='log']")?.textContent).not.toContain("abcbcddef");
  });

  it("enables Copy for transcript selection and shares copied text with another Konsole", async () => {
    renderKonsoles([createWindow("app:konsole", true), createWindow("app:konsole::2", false)]);
    const firstInput = commandInput("app:konsole");
    changeInput(firstInput, "echo source");
    act(() => firstInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })));
    const transcriptText = root("app:konsole").querySelector(".konsole-command-text")?.firstChild;
    if (!transcriptText) throw new Error("Missing transcript command text");
    act(() => {
      const range = document.createRange();
      range.selectNodeContents(transcriptText);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      root("app:konsole").querySelector(".konsole-terminal")?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    click(root("app:konsole"), "Edit");
    click(menu("Edit"), "Copy");
    await act(async () => { await Promise.resolve(); });

    click(root("app:konsole::2"), "Edit");
    click(menu("Edit"), "Paste");
    expect(commandInput("app:konsole::2").value).toBe("echo source");
  });

  it("keeps schema state isolated and routes the exact Help order to Runtime About windows", () => {
    const onAbout = vi.fn();
    renderKonsoles([createWindow("app:konsole", true), createWindow("app:konsole::2", false)], { onAbout });
    click(root("app:konsole"), "Settings");
    click(menu("Settings"), "Schema");
    click(menu("Schema"), "Green on Black");

    expect(root("app:konsole").querySelector<HTMLElement>(".konsole-terminal")?.style.getPropertyValue("--konsole-terminal-foreground")).toBe("#18f018");
    expect(root("app:konsole::2").querySelector<HTMLElement>(".konsole-terminal")?.style.getPropertyValue("--konsole-terminal-foreground")).toBe("#000000");

    click(root("app:konsole::2"), "Help");
    expect([...menu("Help").querySelectorAll<HTMLButtonElement>("button")].map((button) => button.textContent)).toEqual(["About Konsole", "About KDE"]);
    click(menu("Help"), "About Konsole");
    expect(onAbout).toHaveBeenCalledWith("app:konsole::2", "about-konsole");
    expect(root("app:konsole::2").querySelector(".konsole-about")).toBeNull();

    click(root("app:konsole"), "Help");
    click(menu("Help"), "About KDE");
    expect(onAbout).toHaveBeenCalledWith("app:konsole", "about-kde");
  });
});
