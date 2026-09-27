import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DesktopPreferencesProvider } from "../preferences/DesktopPreferencesContext";
import { DEFAULT_DESKTOP_PREFERENCES } from "../preferences/desktopPreferences";
import { WindowManagerContext, type WindowManagerContextValue } from "../window-manager/useWindowManager";
import type { DesktopId, DesktopWindow, WorkArea } from "../window-manager/types";
import { Taskbar } from "./Taskbar";

const taskbarSource = readFileSync(new URL("./Taskbar.tsx", import.meta.url), "utf8");

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 900,
  height: 640,
  titleBarHeight: 22,
};

const makeWindow = (overrides: Partial<DesktopWindow> & Pick<DesktopWindow, "id">): DesktopWindow => ({
  appId: overrides.id,
  title: overrides.id,
  iconId: "about",
  desktopId: 1,
  bounds: { x: 20, y: 20, width: 320, height: 220 },
  zIndex: 20,
  isActive: false,
  state: "normal",
  isDraggable: true,
  minimumWidth: 280,
  minimumHeight: 180,
  isResizable: true,
  ...overrides,
});

const baseWindows = [
  makeWindow({ id: "about", appId: "about", title: "About die Nische", desktopId: 1 }),
  makeWindow({
    id: "konqueror",
    appId: "konqueror",
    title: "Conquer your Desktop! - Konqueror",
    desktopId: 1,
    isActive: true,
    zIndex: 30,
  }),
  makeWindow({ id: "desk2", appId: "about", title: "Desktop 2 About", desktopId: 2 }),
] satisfies readonly DesktopWindow[];

const renderTaskbar = (
  windows: readonly DesktopWindow[],
  currentDesktopId: DesktopId = 1,
  showTasksFromAllDesktops = false,
  launcherMetadataByWindowId: WindowManagerContextValue["launcherMetadataByWindowId"] = {},
): string => {
  const context: WindowManagerContextValue = {
    windows,
    currentDesktopId,
    lastActiveWindowIdByDesktop: {
      1: "konqueror",
      2: "desk2",
      3: null,
      4: null,
    },
    showDesktopSessionByDesktop: {
      1: null,
      2: null,
      3: null,
      4: null,
    },
    launcherMetadataByWindowId,
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

  return renderToStaticMarkup(
    <DesktopPreferencesProvider initialPreferences={{ ...DEFAULT_DESKTOP_PREFERENCES, showTasksFromAllDesktops }}>
      <WindowManagerContext.Provider value={context}>
        <Taskbar />
      </WindowManagerContext.Provider>
    </DesktopPreferencesProvider>,
  );
};

describe("Taskbar virtual desktop filtering", () => {
  it("routes task and group member actions to exact existing WindowIds without application launch APIs", () => {
    expect(taskbarSource).toContain("focusWindow(desktopWindow.id)");
    expect(taskbarSource).toContain("toggleTaskbarWindow(desktopWindow.id)");
    expect(taskbarSource).toContain("onSelectWindow={(windowId) => {");
    expect(taskbarSource).toContain("member.id === windowId");
    expect(taskbarSource).not.toContain("launchApplication(");
    expect(taskbarSource).not.toContain("launchNewApplicationInstance(");
  });

  it("renders every application icon in the compact two-row task render box", () => {
    const markup = renderTaskbar(baseWindows, 1);

    expect(markup).toContain('width="14"');
    expect(markup).toContain('height="14"');
  });

  it("keeps an active non-minimizable task actionable without presenting a minimize action", () => {
    const markup = renderTaskbar([
      makeWindow({ id: "calendar", appId: "calendar", title: "Calendar", isActive: true, isMinimizable: false }),
    ]);

    expect(markup).toContain('aria-label="Activate Calendar"');
    expect(markup).not.toContain('aria-label="Minimize Calendar"');
  });

  it("filters a dynamically introduced desktop with the existing taskbar scope rules", () => {
    const desktopOne = makeWindow({ id: "desktop-one", desktopId: 1 });
    const desktopFive = makeWindow({ id: "desktop-five", desktopId: 5 });

    const currentOnly = renderTaskbar([desktopOne, desktopFive], 5, false);
    const allDesktops = renderTaskbar([desktopOne, desktopFive], 5, true);

    expect(currentOnly).toContain("desktop-five");
    expect(currentOnly).not.toContain("desktop-one");
    expect(allDesktops).toContain("desktop-five");
    expect(allDesktops).toContain("desktop-one");
  });

  it("uses WindowId-scoped semantic icons for ordinary tasks and group representatives", () => {
    const documents = makeWindow({ id: "app:konqueror", appId: "konqueror", title: "Documents - Konqueror", isActive: true });
    const trash = makeWindow({ id: "app:konqueror::2", appId: "konqueror", title: "Trash - Konqueror" });
    const metadata = {
      [documents.id]: { isHomeLocation: false, semanticIconId: "documents" },
      [trash.id]: { isHomeLocation: false, semanticIconId: "trash" },
    };

    expect(renderTaskbar([documents], 1, false, metadata)).toContain('aria-label="Documents folder"');
    const groupedMarkup = renderTaskbar([documents, trash], 1, false, metadata);
    expect(groupedMarkup).toContain('aria-label="Documents folder"');
    expect(groupedMarkup).not.toContain('aria-label="Trash"');
  });

  it("keeps off-desktop semantic icons independent from minimized presentation", () => {
    const documents = makeWindow({ id: "app:konqueror", appId: "konqueror", title: "Documents - Konqueror", desktopId: 2 });
    const metadata = {
      [documents.id]: { isHomeLocation: false, semanticIconId: "documents" },
    };
    const markup = renderTaskbar([documents], 1, true, metadata);

    expect(markup).toContain('aria-label="Documents folder"');
    expect(markup).toContain('data-task-window-icon-state="running"');
  });

  it("uses the representative's semantic icon and minimized presentation for a grouped task", () => {
    const documents = makeWindow({
      id: "app:konqueror",
      appId: "konqueror",
      title: "Documents - Konqueror",
      state: "minimized",
    });
    const downloads = makeWindow({ id: "app:konqueror::2", appId: "konqueror", title: "Downloads - Konqueror" });
    const markup = renderTaskbar([documents, downloads], 1, false, {
      [documents.id]: { isHomeLocation: false, semanticIconId: "documents" },
      [downloads.id]: { isHomeLocation: false, semanticIconId: "downloads" },
    });

    expect(markup).toContain('aria-label="Documents folder"');
    expect(markup).toContain('data-task-window-icon-state="minimized"');
  });

  it("maps stable task sequence to a two-row column-major grid", () => {
    const markup = renderTaskbar([
      baseWindows[0],
      baseWindows[1],
      makeWindow({ id: "kwrite", appId: "kwrite", title: "KWrite" }),
      makeWindow({ id: "kcalc", appId: "kcalc", title: "KCalc" }),
    ]);

    expect(markup).toContain("--taskbar-column-count:2");
    expect(markup.indexOf("About die Nische")).toBeLessThan(markup.indexOf("Conquer your Desktop! - Konqueror"));
    expect(markup.indexOf("Conquer your Desktop! - Konqueror")).toBeLessThan(markup.indexOf("KWrite"));
    expect(markup.indexOf("KWrite")).toBeLessThan(markup.indexOf("KCalc"));
  });

  it("renders only current desktop windows", () => {
    const markup = renderTaskbar(baseWindows, 1);

    expect(markup).toContain("About die Nische");
    expect(markup).toContain("Conquer your Desktop! - Konqueror");
    expect(markup).not.toContain("Desktop 2 About");
  });

  it("updates the button set for another current desktop", () => {
    const markup = renderTaskbar(baseWindows, 2);

    expect(markup).not.toContain("Conquer your Desktop! - Konqueror");
    expect(markup).toContain("Desktop 2 About");
  });

  it("projects all desktops before grouping only when the preference is enabled", () => {
    const first = makeWindow({ id: "app:konqueror", appId: "konqueror", title: "Documents - Konqueror", desktopId: 1 });
    const second = makeWindow({ id: "app:konqueror::2", appId: "konqueror", title: "Documents - Konqueror<2>", desktopId: 2 });

    expect(renderTaskbar([first, second], 1)).toContain('data-window-id="app:konqueror"');
    const allDesktopMarkup = renderTaskbar([first, second], 1, true);
    expect(allDesktopMarkup).toContain('data-app-id="konqueror"');
    expect(allDesktopMarkup).toContain("Documents - Konqueror");
    expect(allDesktopMarkup).not.toContain('data-window-id="app:konqueror"');
  });

  it("keeps off-desktop running and minimized task presentation tied to their own window state", () => {
    const running = makeWindow({ id: "kwrite", appId: "kwrite", title: "KWrite", desktopId: 2, state: "normal" });
    const minimized = makeWindow({ id: "kcalc", appId: "kcalc", title: "KCalc", desktopId: 3, state: "minimized" });
    const markup = renderTaskbar([running, minimized], 1, true);

    expect(markup).toContain("KWrite");
    expect(markup).toContain("KCalc");
    expect(markup.match(/data-task-window-icon-state="running"/g)).toHaveLength(1);
    expect(markup.match(/data-task-window-icon-state="minimized"/g)).toHaveLength(1);
  });

  it("keeps current desktop task order in registration order and includes minimized windows", () => {
    const markup = renderTaskbar(
      [
        baseWindows[0],
        { ...baseWindows[1], state: "minimized", isActive: false },
        baseWindows[2],
      ],
      1,
    );

    expect(markup.indexOf("About die Nische")).toBeLessThan(
      markup.indexOf("Conquer your Desktop! - Konqueror"),
    );
    expect(markup).toContain("kde-task-button--minimized");
    expect(markup).toContain('data-task-window-icon-state="minimized"');
  });

  it("renders no task buttons for an empty desktop", () => {
    const markup = renderTaskbar(baseWindows, 2);
    const emptyMarkup = renderTaskbar(
      baseWindows.filter((window) => window.desktopId !== 2),
      2,
    );

    expect(markup).toContain("task-button");
    expect(emptyMarkup).not.toContain("task-button");
  });

  it("keeps show-desktop-hidden normal windows in the taskbar without minimized styling", () => {
    const markup = renderTaskbar(
      baseWindows.map((window) => ({ ...window, isActive: false })),
      1,
    );

    expect(markup).toContain("About die Nische");
    expect(markup).toContain("Conquer your Desktop! - Konqueror");
    expect(markup).not.toContain("aria-pressed=\"true\"");
    expect(markup).not.toContain("kde-task-button--minimized");
    expect(markup).toContain('data-task-window-icon-state="running"');
  });

  it("reflects a moved window through current desktop filtering without reordering", () => {
    const movedWindows = [
      { ...baseWindows[0], desktopId: 3 as const },
      baseWindows[1],
      baseWindows[2],
    ];
    const desktopOneMarkup = renderTaskbar(movedWindows, 1);
    const desktopThreeMarkup = renderTaskbar(movedWindows, 3);

    expect(desktopOneMarkup).not.toContain("About die Nische");
    expect(desktopOneMarkup).toContain("Conquer your Desktop! - Konqueror");
    expect(desktopThreeMarkup).toContain("About die Nische");
  });

  it("keeps same-application windows as independent task identities", () => {
    const markup = renderTaskbar([
      makeWindow({ id: "app:konqueror", appId: "konqueror", title: "Documents - Konqueror", isActive: true }),
      makeWindow({ id: "app:konqueror::2", appId: "konqueror", title: "Downloads - Konqueror", zIndex: 30 }),
    ]);

    expect(markup).toContain('data-app-id="konqueror"');
    expect(markup).not.toContain('data-window-id="app:konqueror"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain("Documents - Konqueror");
    expect(markup).not.toContain("Downloads - Konqueror");
  });

  it("keeps a lone Konqueror as an ordinary task and groups only current-desktop peers", () => {
    const first = makeWindow({ id: "app:konqueror", appId: "konqueror", title: "Documents - Konqueror" });
    const second = makeWindow({ id: "app:konqueror::2", appId: "konqueror", title: "Trash - Konqueror" });
    const offDesktop = makeWindow({ id: "app:konqueror::3", appId: "konqueror", title: "My Computer - Konqueror", desktopId: 2 });

    expect(renderTaskbar([first, offDesktop], 1)).toContain('data-window-id="app:konqueror"');
    const grouped = renderTaskbar([first, second, offDesktop], 1);
    expect(grouped).toContain('data-app-id="konqueror"');
    expect(grouped).not.toContain("My Computer - Konqueror");
  });

  it("keeps a visible single Konqueror icon running on every virtual desktop", () => {
    const windows = [1, 2, 3, 4].map((desktopId) => makeWindow({
      id: `app:konqueror::${desktopId}`,
      appId: "konqueror",
      title: `Desktop ${desktopId} - Konqueror`,
      desktopId: desktopId as DesktopId,
    }));

    for (const desktopId of [1, 2, 3, 4] as const) {
      const markup = renderTaskbar(windows, desktopId);
      expect(markup).toContain('data-task-window-icon-state="running"');
      expect(markup).not.toContain('data-task-window-icon-state="minimized"');
    }
  });

  it("keeps the two-row layout input based on derived task entries", () => {
    const markup = renderTaskbar([
      makeWindow({ id: "app:konqueror", appId: "konqueror", title: "Documents - Konqueror" }),
      makeWindow({ id: "app:konqueror::2", appId: "konqueror", title: "Trash - Konqueror" }),
      makeWindow({ id: "kwrite", appId: "kwrite", title: "KWrite" }),
      makeWindow({ id: "kcalc", appId: "kcalc", title: "KCalc" }),
    ]);

    expect(markup).toContain("--taskbar-column-count:2");
    expect(markup).toContain("taskbar__grid");
  });

  it("portals only an open group popup into the shell transient layer while retaining popup containment", () => {
    const source = readFileSync(new URL("./Taskbar.tsx", import.meta.url), "utf8");

    expect(source).toContain("useDesktopTransientPopupLayer");
    expect(source).toContain("createPortal(groupPopup, transientPopupLayer.layer)");
    expect(source).toContain("popupRefs: [groupPopupRef]");
    expect(source).toContain("getTaskGroupPopupPosition(anchorRect, popupWidth, screenArea)");
    expect(source).not.toContain("document.body");
  });
});
