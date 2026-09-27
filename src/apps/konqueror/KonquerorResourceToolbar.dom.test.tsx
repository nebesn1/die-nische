// @vitest-environment jsdom
import { StrictMode, act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsTextFile } from "../../vfs/mutations";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { Konqueror } from "./Konqueror";
import { KonquerorClipboardProvider } from "./KonquerorClipboardContext";

const homeLaunchRequest: ApplicationLaunchRequest = {
  requestId: 1,
  intent: { type: "open-special-location", location: "home" },
};

let container: HTMLDivElement;
let reactRoot: Root;
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;

const createVfsContextValue = (): VfsContextValue => {
  const state = createInitialVfsState();
  return {
    state,
    ...createVfsOperations(
      () => state,
      () => undefined,
    ),
  };
};

const renderResourceKonqueror = (children: ReactNode) => {
  reactRoot.render(
    <StrictMode>
      <ApplicationLauncherContext.Provider value={{
        launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
        launchNewApplicationInstance,
      }}>
        <VfsContext.Provider value={createVfsContextValue()}>{children}</VfsContext.Provider>
      </ApplicationLauncherContext.Provider>
    </StrictMode>,
  );
};

const SharedVfsFixture = ({ children }: { readonly children: ReactNode }) => {
  const [state, setState] = useState(() => {
    const picture = createVfsTextFile(createInitialVfsState(), "/home/user/Pictures", "Photo.txt", "photo", {
      now: "2026-08-30T00:00:00.000Z",
    });
    if (!picture.ok) throw new Error("Shared VFS fixture failed");
    return picture.state;
  });
  const operations = useMemo(
    () => createVfsOperations(() => state, setState),
    [state],
  );

  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const getApplication = (index = 0): HTMLElement => {
  const application = container.querySelectorAll<HTMLElement>(".konqueror-application")[index];
  if (!application) throw new Error("Missing Konqueror application");
  return application;
};

const click = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const ctrlClick = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true })));
};

const shiftClick = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, shiftKey: true })));
};

const ctrlShiftClick = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true, shiftKey: true })));
};

const openItemContextMenu = (element: HTMLElement): void => {
  const target = element.querySelector<HTMLElement>(".konqueror-directory-item-hit-target") ?? element;
  act(() => target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 24, clientY: 28 })));
};

const openContextMenu = (element: HTMLElement, clientX: number, clientY: number): MouseEvent => {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY });
  act(() => element.dispatchEvent(event));
  return event;
};

const contextMenuLabels = (): string[] => [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
  .map((item) => item.textContent ?? "");

const getContextMenuAction = (label: string, scope: ParentNode = container): HTMLButtonElement | null =>
  [...scope.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
    .find((item) => item.textContent === label) ?? null;

const getMenuButton = (application: HTMLElement, label: string): HTMLButtonElement | undefined =>
  [...application.querySelectorAll<HTMLButtonElement>(".konqueror-menubar button")]
    .find((button) => button.textContent === label);

describe("Konqueror Resource Manager toolbar", () => {
  it("uses only Tree item content for item menus and routes Name whitespace and details cells to the background menu", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const directoryRow = application.querySelector<HTMLButtonElement>(".konqueror-directory-row[role='option']");
    if (!directoryRow) throw new Error("Missing Tree View directory row");
    const itemTarget = directoryRow.querySelector<HTMLElement>(".konqueror-directory-item-hit-target");
    const icon = itemTarget?.querySelector<HTMLElement>(".konqueror-node-icon");
    const expander = directoryRow.querySelector<HTMLElement>(".konqueror-tree-expander");
    const nameCell = directoryRow.querySelector<HTMLElement>(".konqueror-directory-cell--name");
    const details = [...directoryRow.querySelectorAll<HTMLElement>(".konqueror-directory-cell:not(.konqueror-directory-cell--name)")];
    if (!itemTarget || !icon || !expander || !nameCell || details.length !== 3) throw new Error("Missing Tree View context-menu targets");

    expect(openContextMenu(icon, 24, 28).defaultPrevented).toBe(true);
    expect(contextMenuLabels()).toContain("Open");
    expect(contextMenuLabels()).not.toContain("Create New");
    expect(container.querySelectorAll("[aria-label='Konqueror context menu']")).toHaveLength(1);

    click(directoryRow);
    expect(openContextMenu(expander, 26, 30).defaultPrevented).toBe(true);
    expect(contextMenuLabels().some((label) => label.startsWith("Create New"))).toBe(true);
    expect(contextMenuLabels()).not.toContain("Open");
    expect(application.querySelector(".konqueror-directory-row.is-selected")).toBeNull();

    expect(openContextMenu(nameCell, 30, 34).defaultPrevented).toBe(true);
    expect(contextMenuLabels().some((label) => label.startsWith("Create New"))).toBe(true);
    expect(contextMenuLabels()).not.toContain("Open");
    expect(application.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
    expect(container.querySelectorAll("[aria-label='Konqueror context menu']")).toHaveLength(1);

    details.forEach((cell, index) => {
      openContextMenu(cell, 40 + index, 44 + index);
      expect(contextMenuLabels().some((label) => label.startsWith("Create New"))).toBe(true);
      expect(contextMenuLabels()).not.toContain("Open");
      expect(container.querySelectorAll("[aria-label='Konqueror context menu']")).toHaveLength(1);
    });

    click(application.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    const fileRow = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']");
    const fileTarget = fileRow?.querySelector<HTMLElement>(".konqueror-directory-item-hit-target");
    if (!fileTarget) throw new Error("Missing Tree View file target");
    openContextMenu(fileTarget, 52, 56);
    expect(contextMenuLabels()).not.toContain("Open");
    expect(contextMenuLabels()).toContain("Open in New Window");
    expect(contextMenuLabels()).not.toContain("Create New");
  });

  it("opens Properties for the current directory from a selected-row background target", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const directoryRow = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-documents']");
    const sizeCell = directoryRow?.querySelector<HTMLElement>(".konqueror-directory-cell:not(.konqueror-directory-cell--name)");
    if (!directoryRow || !sizeCell) throw new Error("Missing Tree View background target");

    click(directoryRow);
    openContextMenu(sizeCell, 66, 70);
    expect(application.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
    const properties = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
      .find((item) => item.textContent === "Properties");
    click(properties ?? null);

    expect(application.querySelector(".konqueror-properties-dialog")?.textContent).toContain('Properties for "user"');
    expect(application.querySelector(".konqueror-properties-dialog")?.textContent).not.toContain('Properties for "Documents"');
  });

  it("uses the existing Up, Back, and Forward authorities from the background menu", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const location = application.querySelector<HTMLInputElement>("#konqueror-location");
    const directory = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!directory || !location) throw new Error("Missing Tree View navigation fixture");

    openContextMenu(directory, 74, 78);
    expect(contextMenuLabels()).toEqual(["Create New▶", "Up", "Back", "Forward", "Paste Clipboard Contents", "Actions▶", "Copy To", "Move To", "Properties"]);
    expect(getContextMenuAction("Up")?.disabled).toBe(false);
    expect(getContextMenuAction("Back")?.disabled).toBe(true);
    expect(getContextMenuAction("Forward")?.disabled).toBe(true);
    expect(getContextMenuAction("Paste Clipboard Contents")?.disabled).toBe(true);
    expect(getContextMenuAction("Copy To")?.disabled).toBe(true);
    expect(getContextMenuAction("Move To")?.disabled).toBe(true);
    click(getContextMenuAction("Up"));
    expect(location.value).toBe("/home");

    const atHome = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!atHome) throw new Error("Missing parent Tree View");
    openContextMenu(atHome, 80, 84);
    expect(getContextMenuAction("Back")?.disabled).toBe(false);
    expect(getContextMenuAction("Forward")?.disabled).toBe(true);
    click(getContextMenuAction("Back"));
    expect(location.value).toBe("/home/user");

    const atUser = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!atUser) throw new Error("Missing returned Tree View");
    openContextMenu(atUser, 86, 90);
    expect(getContextMenuAction("Forward")?.disabled).toBe(false);
    click(getContextMenuAction("Forward"));
    expect(location.value).toBe("/home");

    const rootward = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!rootward) throw new Error("Missing parent Tree View");
    openContextMenu(rootward, 92, 96);
    click(getContextMenuAction("Up"));
    expect(location.value).toBe("/");
    const root = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!root) throw new Error("Missing root Tree View");
    openContextMenu(root, 98, 102);
    expect(getContextMenuAction("Up")?.disabled).toBe(true);
  });

  it("derives background history actions from the invoking Konqueror instance", () => {
    act(() => {
      renderResourceKonqueror(
        <>
          <Konqueror windowId="konqueror-a" launchRequest={homeLaunchRequest} isActive focusRequestId={1} />
          <Konqueror windowId="konqueror-b" launchRequest={homeLaunchRequest} isActive={false} focusRequestId={0} />
        </>,
      );
    });
    const first = getApplication(0);
    const second = getApplication(1);
    const firstLocation = first.querySelector<HTMLInputElement>("#konqueror-location");
    const secondLocation = second.querySelector<HTMLInputElement>("#konqueror-location");
    const firstDirectory = first.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!firstLocation || !secondLocation || !firstDirectory) throw new Error("Missing multi-instance navigation fixture");

    openContextMenu(firstDirectory, 104, 108);
    click(getContextMenuAction("Up"));
    expect(firstLocation.value).toBe("/home");
    expect(secondLocation.value).toBe("/home/user");

    const firstAtHome = first.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!firstAtHome) throw new Error("Missing first parent Tree View");
    openContextMenu(firstAtHome, 110, 114);
    expect(getContextMenuAction("Back", first)?.disabled).toBe(false);

    const secondDirectory = second.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!secondDirectory) throw new Error("Missing second Tree View");
    openContextMenu(secondDirectory, 116, 120);
    expect(getContextMenuAction("Back", second)?.disabled).toBe(true);
    expect(secondLocation.value).toBe("/home/user");
  });

  it("clears selection only from true Tree/Icon background surfaces and preserves it across view switches", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const tree = application.querySelector<HTMLElement>(".konqueror-directory-view");
    const treeRows = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (!tree || treeRows.length < 2) throw new Error("Missing Tree View fixture rows");

    click(treeRows[0]);
    expect(treeRows[0].getAttribute("aria-selected")).toBe("true");
    click(tree);
    expect(application.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
    expect(document.activeElement).toBe(tree);

    click(treeRows[1]);
    expect(treeRows[1].getAttribute("aria-selected")).toBe("true");
    click(application.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    const icon = application.querySelector<HTMLElement>(".konqueror-icon-view");
    expect(application.querySelector(".konqueror-icon-item.is-selected")).not.toBeNull();
    if (!icon) throw new Error("Missing Icon View");

    click(icon);
    expect(application.querySelector(".konqueror-icon-item.is-selected")).toBeNull();
    click(application.querySelector<HTMLElement>("button[aria-label='Tree View']"));
    expect(application.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
  });

  it("shares Tree/Icon state with the View menu and remembers independent zoom per view", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const address = application.querySelector<HTMLInputElement>("#konqueror-location");
    const firstTreeRow = application.querySelector<HTMLElement>(".konqueror-directory-row[role='option']");

    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='normal']")).not.toBeNull();
    expect(application.querySelector("button[aria-label='Tree View']")?.getAttribute("aria-pressed")).toBe("true");
    click(firstTreeRow);
    click(application.querySelector<HTMLElement>("button[aria-label='Zoom Out']"));
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom Out']")?.disabled).toBe(true);
    click(application.querySelector<HTMLElement>("button[aria-label='Reload']"));
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
    expect(application.querySelector(".konqueror-directory-row.is-selected")).not.toBeNull();

    click(application.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(application.querySelector("[data-resource-view='icons'][data-resource-zoom='normal']")).not.toBeNull();
    expect(application.querySelector(".konqueror-icon-item.is-selected")).not.toBeNull();
    click(application.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    expect(application.querySelector("[data-resource-view='icons'][data-resource-zoom='large']")).not.toBeNull();

    click(getMenuButton(application, "View") ?? null);
    click(document.querySelector<HTMLElement>("button[data-submenu-id='view-mode']"));
    const treeMenuItem = document.querySelector<HTMLElement>("button[role='menuitemradio'][title='Tree View']");
    click(treeMenuItem);
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
    expect(application.querySelector("button[aria-label='Tree View']")?.getAttribute("aria-pressed")).toBe("true");
    expect(application.querySelector("button[aria-label='Icon View']")?.getAttribute("aria-pressed")).toBe("false");
    expect(application.querySelector(".konqueror-directory-row.is-selected")).not.toBeNull();

    click(application.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(application.querySelector("[data-resource-view='icons'][data-resource-zoom='large']")).not.toBeNull();
    click(application.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    expect(application.querySelector("[data-resource-view='icons'][data-resource-zoom='extra-large']")).not.toBeNull();
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom In']")?.disabled).toBe(true);
    expect(address?.value).toBe("/home/user");
  });

  it("keeps multi-selection through view and zoom changes while ordinary keyboard movement collapses it", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const rows = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (rows.length < 2) throw new Error("Missing Tree View fixture rows");

    click(rows[0]);
    ctrlClick(rows[1]);
    expect(application.querySelectorAll(".konqueror-directory-row.is-selected")).toHaveLength(2);

    click(application.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    click(application.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(application.querySelectorAll(".konqueror-icon-item.is-selected")).toHaveLength(2);

    click(application.querySelector<HTMLElement>("button[aria-label='Tree View']"));
    const restoredTree = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!restoredTree) throw new Error("Missing restored Tree View fixture");
    act(() => restoredTree.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown" })));
    expect(application.querySelectorAll(".konqueror-directory-row.is-selected")).toHaveLength(1);
  });

  it("uses the current shared visible order for Shift ranges across Tree, Icon, keyboard, and sort changes", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const initialRows = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (initialRows.length < 5) throw new Error("Missing Tree View range fixture rows");

    click(initialRows[1]);
    shiftClick(initialRows[3]);
    expect([...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")]
      .map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "true", "true", "true", "false", "false"]);

    click(application.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(application.querySelectorAll(".konqueror-icon-item.is-selected")).toHaveLength(3);
    click(application.querySelector<HTMLElement>("button[aria-label='Tree View']"));
    const restoredTree = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!restoredTree) throw new Error("Missing restored Tree View fixture");
    act(() => restoredTree.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown" })));
    const afterArrow = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    expect(afterArrow.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false", "false", "false"]);
    shiftClick(afterArrow[2]);
    expect(afterArrow.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "true", "true", "false", "false", "false"]);

    click(afterArrow[0]);
    click(application.querySelector<HTMLElement>(".konqueror-directory-header__button"));
    const descendingRows = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    shiftClick(descendingRows[2]);
    expect(descendingRows.map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "false", "true", "true", "true", "true"]);
  });

  it("projects nested Tree rows into selection, view-switch, and Arrow navigation authorities", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const location = application.querySelector<HTMLInputElement>("#konqueror-location");
    const documents = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-documents']");
    const pictures = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-pictures']");
    const expandDocuments = application.querySelector<HTMLElement>("[aria-label='Expand Documents']");
    if (!documents || !pictures || !expandDocuments) throw new Error("Missing nested Tree fixture");

    click(pictures);
    click(expandDocuments);
    expect(location?.value).toBe("/home/user");
    expect(pictures.getAttribute("aria-selected")).toBe("true");
    expect(application.querySelector("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']")).not.toBeNull();
    expect(application.querySelector("[data-konqueror-node-id='vfs-content-76cff3ce17d8a853403179f1']")).not.toBeNull();

    click(documents);
    const tree = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!tree) throw new Error("Missing expanded Tree");
    act(() => tree.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown" })));
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']")?.getAttribute("aria-selected")).toBe("true");

    ctrlClick(pictures);
    click(application.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(application.querySelectorAll(".konqueror-icon-item.is-selected")).toHaveLength(1);
    expect(application.querySelector<HTMLElement>(".konqueror-icon-item[data-konqueror-node-id='vfs-pictures']")?.getAttribute("aria-selected")).toBe("true");

    click(application.querySelector<HTMLElement>("button[aria-label='Tree View']"));
    expect(application.querySelector("[aria-label='Collapse Documents']")).not.toBeNull();
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']")?.getAttribute("aria-selected")).toBe("false");

    click(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']"));
    ctrlClick(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-76cff3ce17d8a853403179f1']"));
    click(application.querySelector<HTMLElement>("[aria-label='Collapse Documents']"));
    expect(application.querySelectorAll(".konqueror-directory-row.is-selected")).toHaveLength(0);
  });

  it("uses classic Tree Left and Right actions through the shared expansion and selection authorities", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const tree = application.querySelector<HTMLElement>(".konqueror-directory-view");
    const documents = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-documents']");
    const desktop = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-desktop']");
    if (!tree || !documents || !desktop) throw new Error("Missing Tree keyboard fixture");
    const sendTreeKey = (key: "ArrowLeft" | "ArrowRight") => {
      act(() => tree.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key })));
    };

    click(documents);
    sendTreeKey("ArrowRight");
    expect(application.querySelector("[aria-label='Collapse Documents']")).not.toBeNull();
    expect(documents.getAttribute("aria-selected")).toBe("true");

    sendTreeKey("ArrowRight");
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']")?.getAttribute("aria-selected")).toBe("true");

    sendTreeKey("ArrowLeft");
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-documents']")?.getAttribute("aria-selected")).toBe("true");
    sendTreeKey("ArrowLeft");
    expect(application.querySelector("[aria-label='Expand Documents']")).not.toBeNull();
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-documents']")?.getAttribute("aria-selected")).toBe("true");

    click(desktop);
    sendTreeKey("ArrowRight");
    expect(application.querySelector("[aria-label='Collapse Desktop']")).not.toBeNull();
    sendTreeKey("ArrowRight");
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-desktop']")?.getAttribute("aria-selected")).toBe("true");
    sendTreeKey("ArrowLeft");
    expect(application.querySelector("[aria-label='Expand Desktop']")).not.toBeNull();
  });

  it("keeps empty directory expansion independent from child presence and selection context", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const location = application.querySelector<HTMLInputElement>("#konqueror-location");
    const desktop = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-desktop']");
    const music = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-music']");
    const pictures = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-pictures']");
    const expandDesktop = application.querySelector<HTMLElement>("[aria-label='Expand Desktop']");
    if (!desktop || !music || !pictures || !expandDesktop) throw new Error("Missing empty folder fixture");

    click(pictures);
    click(expandDesktop);
    expect(application.querySelector("[aria-label='Collapse Desktop']")).not.toBeNull();
    expect(location?.value).toBe("/home/user");
    expect(pictures.getAttribute("aria-selected")).toBe("true");
    shiftClick(music);
    expect(music.getAttribute("aria-selected")).toBe("true");
    expect(pictures.getAttribute("aria-selected")).toBe("true");

    click(application.querySelector<HTMLElement>("[aria-label='Collapse Desktop']"));
    expect(application.querySelector("[aria-label='Expand Desktop']")).not.toBeNull();
    click(application.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    expect(application.querySelector("[aria-label='Expand Notes.txt']")).toBeNull();
  });

  it("uses flattened DFS rows for Tree Shift ranges", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    click(application.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    const notes = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']");
    const pictures = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-pictures']");
    if (!notes || !pictures) throw new Error("Missing nested Tree range fixture");

    click(notes);
    shiftClick(pictures);

    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-documents']")?.getAttribute("aria-selected")).toBe("false");
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']")?.getAttribute("aria-selected")).toBe("true");
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-76cff3ce17d8a853403179f1']")?.getAttribute("aria-selected")).toBe("true");
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-downloads']")?.getAttribute("aria-selected")).toBe("true");
    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-music']")?.getAttribute("aria-selected")).toBe("true");
    expect(pictures.getAttribute("aria-selected")).toBe("true");
  });

  it("adds Ctrl+Shift range membership and enables batch Copy", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const rows = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (rows.length < 5) throw new Error("Missing Tree View additive range fixture rows");

    click(rows[0]);
    ctrlClick(rows[2]);
    ctrlShiftClick(rows[4]);

    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "false", "true", "true", "true", "false"]);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Copy']")?.disabled).toBe(false);
  });

  it("uses the frozen nested context-menu group for cross-parent Cut and preserves raw cut-pending presentation", () => {
    act(() => {
      reactRoot.render(
        <StrictMode>
          <ApplicationLauncherContext.Provider value={{
            launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
            launchNewApplicationInstance,
          }}>
            <SharedVfsFixture><Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} /></SharedVfsFixture>
          </ApplicationLauncherContext.Provider>
        </StrictMode>,
      );
    });
    const application = getApplication();
    click(application.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    click(application.querySelector<HTMLElement>("[aria-label='Expand Pictures']"));
    const notes = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']");
    const photo = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row")]
      .find((row) => row.textContent?.includes("Photo.txt"));
    if (!notes || !photo) throw new Error("Cross-parent Cut fixture missing");

    click(notes);
    ctrlClick(photo);
    expect(notes.getAttribute("aria-selected")).toBe("true");
    expect(photo.getAttribute("aria-selected")).toBe("true");
    openItemContextMenu(photo);
    const cut = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
      .find((item) => item.textContent === "Cut");
    expect(cut?.title).toBe("Cut");
    expect(cut?.disabled).toBe(false);
    click(cut ?? null);

    expect(application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']")?.dataset.cutPending).toBe("true");
    expect([...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row")]
      .find((row) => row.textContent?.includes("Photo.txt"))?.dataset.cutPending).toBe("true");
    expect(application.querySelectorAll(".konqueror-directory-row.is-selected")).toHaveLength(2);
  });

  it("shares frozen cross-parent clipboard entries across Konqueror instances and selects all Paste results", () => {
    const downloadsLaunchRequest: ApplicationLaunchRequest = {
      requestId: 2,
      intent: { type: "open-special-location", location: "downloads" },
    };
    act(() => {
      reactRoot.render(
        <StrictMode>
          <ApplicationLauncherContext.Provider value={{
            launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
            launchNewApplicationInstance,
          }}>
            <SharedVfsFixture>
              <KonquerorClipboardProvider>
                <Konqueror windowId="konqueror-a" launchRequest={homeLaunchRequest} isActive focusRequestId={1} />
                <Konqueror windowId="konqueror-b" launchRequest={downloadsLaunchRequest} isActive={false} focusRequestId={0} />
              </KonquerorClipboardProvider>
            </SharedVfsFixture>
          </ApplicationLauncherContext.Provider>
        </StrictMode>,
      );
    });
    const source = getApplication(0);
    const destination = getApplication(1);
    click(source.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    click(source.querySelector<HTMLElement>("[aria-label='Expand Pictures']"));
    const notes = source.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']");
    const photo = [...source.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row")]
      .find((row) => row.textContent?.includes("Photo.txt"));
    if (!notes || !photo) throw new Error("Shared clipboard fixture missing");

    click(notes);
    ctrlClick(photo);
    click(source.querySelector<HTMLButtonElement>("button[aria-label='Copy']"));
    expect(destination.querySelector<HTMLButtonElement>("button[aria-label='Paste']")?.disabled).toBe(false);
    click(destination.querySelector<HTMLButtonElement>("button[aria-label='Paste']"));

    expect(destination.textContent).toContain("Notes.txt");
    expect(destination.textContent).toContain("Photo.txt");
    expect(destination.querySelectorAll(".konqueror-directory-row.is-selected")).toHaveLength(2);
    expect(source.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']")?.getAttribute("aria-selected")).toBe("true");
    expect([...source.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row")]
      .find((row) => row.textContent?.includes("Photo.txt"))?.getAttribute("aria-selected")).toBe("true");
  });

  it("opens every selected item in a new Konqueror from a selected-member context menu", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const rows = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    if (rows.length < 2) throw new Error("Missing Tree View fixture rows");
    const targetNodeIds = rows.slice(0, 2).map((row) => row.dataset.konquerorNodeId ?? "");

    click(rows[0]);
    ctrlClick(rows[1]);
    openItemContextMenu(rows[1]!);

    const menuItems = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")];
    expect(menuItems.map((item) => item.textContent)).toContain("Open");
    const openInNewWindow = menuItems.find((item) => item.textContent === "Open in New Window");
    click(openInNewWindow ?? null);

    expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "true", "false", "false", "false", "false"]);
    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(2);
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(1, "konqueror", {
      intent: { type: "open-directory", nodeId: targetNodeIds[0] },
    });
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(2, "konqueror", {
      intent: { type: "open-directory", nodeId: targetNodeIds[1] },
    });
  });

  it("uses Tree DFS order for nested context-menu multi-open without mutating the source selection", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    click(application.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    const notes = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-e594a065214576326cb903a5']");
    const welcome = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-content-76cff3ce17d8a853403179f1']");
    const pictures = application.querySelector<HTMLButtonElement>("[data-konqueror-node-id='vfs-pictures']");
    if (!notes || !welcome || !pictures) throw new Error("Missing nested multi-open fixture");

    click(notes);
    ctrlClick(welcome);
    ctrlClick(pictures);
    openItemContextMenu(pictures);
    const openInNewWindow = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
      .find((item) => item.textContent === "Open in New Window");
    click(openInNewWindow ?? null);

    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(3);
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(1, "konqueror", {
      intent: { type: "open-file", nodeId: "vfs-content-e594a065214576326cb903a5" },
    });
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(2, "konqueror", {
      intent: { type: "open-file", nodeId: "vfs-content-76cff3ce17d8a853403179f1" },
    });
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(3, "konqueror", {
      intent: { type: "open-directory", nodeId: "vfs-pictures" },
    });
    expect(application.querySelectorAll(".konqueror-directory-row.is-selected")).toHaveLength(3);
  });

  it("keeps resource view and zoom state isolated between Konqueror instances", () => {
    act(() => {
      renderResourceKonqueror(
        <>
          <Konqueror windowId="konqueror-a" launchRequest={homeLaunchRequest} isActive focusRequestId={1} />
          <Konqueror windowId="konqueror-b" launchRequest={homeLaunchRequest} isActive={false} focusRequestId={0} />
        </>,
      );
    });
    const first = getApplication(0);
    const second = getApplication(1);

    click(first.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    click(first.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    click(second.querySelector<HTMLElement>("button[aria-label='Zoom Out']"));

    expect(first.querySelector("[data-resource-view='icons'][data-resource-zoom='large']")).not.toBeNull();
    expect(second.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
  });

  it("keeps multi-selection membership isolated between same-directory Konqueror instances", () => {
    act(() => {
      renderResourceKonqueror(
        <>
          <Konqueror windowId="konqueror-a" launchRequest={homeLaunchRequest} isActive focusRequestId={1} />
          <Konqueror windowId="konqueror-b" launchRequest={homeLaunchRequest} isActive={false} focusRequestId={0} />
        </>,
      );
    });
    const first = getApplication(0);
    const second = getApplication(1);
    const getRows = (application: HTMLElement): HTMLButtonElement[] =>
      [...application.querySelectorAll<HTMLButtonElement>(".konqueror-directory-row[role='option']")];
    const firstRows = getRows(first);
    const secondRows = getRows(second);
    if (firstRows.length < 4 || secondRows.length < 4) throw new Error("Missing multi-instance Tree fixture rows");

    click(firstRows[1]);
    shiftClick(getRows(first)[3]);
    click(secondRows[3]);
    shiftClick(getRows(first)[2]);

    expect(first.querySelectorAll(".konqueror-directory-row.is-selected")).toHaveLength(2);
    expect(second.querySelectorAll(".konqueror-directory-row.is-selected")).toHaveLength(1);
  });

  it("navigates through the real VFS parents above Home without resetting Resource presentation", () => {
    const onSetWindowTitle = vi.fn();
    act(() => {
      renderResourceKonqueror(
        <Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} onSetWindowTitle={onSetWindowTitle} />,
      );
    });
    const application = getApplication();
    const location = application.querySelector<HTMLInputElement>("#konqueror-location");
    const up = application.querySelector<HTMLButtonElement>("button[aria-label='Up']");

    click(application.querySelector<HTMLElement>("button[aria-label='Zoom Out']"));
    expect(up?.disabled).toBe(false);

    click(up ?? null);
    expect(location?.value).toBe("/home");
    expect(onSetWindowTitle).toHaveBeenLastCalledWith("home - Konqueror");
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
    expect([...application.querySelectorAll<HTMLElement>(".konqueror-directory-row")].some((row) => row.textContent?.includes("user"))).toBe(true);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Up']")?.disabled).toBe(false);

    click(application.querySelector<HTMLElement>("button[aria-label='Up']"));
    expect(location?.value).toBe("/");
    expect(onSetWindowTitle).toHaveBeenLastCalledWith("Root Folder - Konqueror");
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
    expect([...application.querySelectorAll<HTMLElement>(".konqueror-directory-row")].some((row) => row.textContent?.includes("home"))).toBe(true);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Up']")?.disabled).toBe(true);

    click(application.querySelector<HTMLElement>("button[aria-label='Back']"));
    expect(location?.value).toBe("/home");
    click(application.querySelector<HTMLElement>("button[aria-label='Back']"));
    expect(location?.value).toBe("/home/user");
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
  });

  it("preserves Resource presentation state through an independently zoomable external Web location", () => {
    act(() => {
      renderResourceKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    });
    const application = getApplication();
    const input = application.querySelector<HTMLInputElement>("#konqueror-location");
    const form = application.querySelector<HTMLFormElement>("form[aria-label='Konqueror location bar']");

    click(application.querySelector<HTMLElement>("button[aria-label='Zoom Out']"));
    if (!input || !form) throw new Error("Missing Konqueror location controls");

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "https://www.example.com/");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom In']")?.disabled).toBe(false);
    click(application.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    expect(application.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("110");
    click(application.querySelector<HTMLElement>("button[aria-label='Back']"));
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
  });
});
