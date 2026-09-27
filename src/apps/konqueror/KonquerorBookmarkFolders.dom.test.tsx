// @vitest-environment jsdom
import { act, StrictMode, useContext, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { VfsContext } from "../../vfs/VfsContext";
import { Konqueror } from "./Konqueror";
import { KonquerorBookmarksProvider } from "./KonquerorBookmarksContext";
import { KonquerorBookmarksContext } from "./konquerorBookmarksContext";
import { createKonquerorBookmarksStorage, type KonquerorBookmarksStorageBackend } from "./bookmarksPersistence";
import type { KonquerorBookmarkTree } from "./bookmarks";

let container: HTMLDivElement;
let reactRoot: Root;

const documentsRequest: ApplicationLaunchRequest = { requestId: 1, intent: { type: "open-special-location", location: "documents" } };
const homeRequest: ApplicationLaunchRequest = { requestId: 2, intent: { type: "open-special-location", location: "home" } };

const SharedVfsFixture = ({ children }: { readonly children: ReactNode }) => {
  const [state, setState] = useState(createInitialVfsState);
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
};

function createMemoryStorage(): KonquerorBookmarksStorageBackend & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function BookmarkProbe() {
  const { bookmarks } = useContext(KonquerorBookmarksContext);
  return <output data-testid="bookmarks">{JSON.stringify(bookmarks)}</output>;
}

const click = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const setInput = (input: HTMLInputElement, value: string) => {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const getBookmarks = () => JSON.parse(container.querySelector("[data-testid='bookmarks']")?.textContent ?? "{}") as KonquerorBookmarkTree;

const findMenu = (application: HTMLElement, label: string) =>
  [...application.querySelectorAll<HTMLButtonElement>(".konqueror-menuitem")].find((button) => button.textContent === label) ?? null;

const openBookmarks = (application: HTMLElement) => click(findMenu(application, "Bookmarks"));

const navigate = (application: HTMLElement, location: string) => {
  const input = application.querySelector<HTMLInputElement>("#konqueror-location");
  const form = application.querySelector<HTMLFormElement>("form[aria-label='Konqueror location bar']");
  if (!input || !form) throw new Error("Location bar missing");
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, location);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

const openBlankTab = (application: HTMLElement) => {
  click(findMenu(application, "Location"));
  click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
    .find((button) => button.textContent === "New Tab") ?? null);
};

const findMenuAction = (label: string, parentFolderId?: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((button) =>
    button.textContent?.trim().startsWith(label) && (parentFolderId === undefined || button.closest(".konqueror-menu-popup")?.textContent?.includes(label)),
  ) ?? null;

const openFolderSubmenu = (folderId: string) => click(container.querySelector<HTMLButtonElement>(`button[data-submenu-id='bookmark-folder-${folderId}']`));

const renderKonquerors = (requests: readonly ApplicationLaunchRequest[], initialBookmarks?: KonquerorBookmarkTree) => {
  const storage = createMemoryStorage();
  let nextBookmarkId = 1;
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{
          launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
          launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened"),
        }}>
          <KonquerorBookmarksProvider
            initialBookmarks={initialBookmarks}
            storage={createKonquerorBookmarksStorage(() => storage)}
            createNodeId={() => `bookmark-${nextBookmarkId++}`}
          >
            <SharedVfsFixture>
              {requests.map((request, index) => (
                <Konqueror key={index} windowId={`bookmark-folder-window-${index + 1}`} launchRequest={request} isActive focusRequestId={index + 1} />
              ))}
              <BookmarkProbe />
            </SharedVfsFixture>
          </KonquerorBookmarksProvider>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
  return { applications: [...container.querySelectorAll<HTMLElement>(".konqueror-application")], storage };
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
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

describe("Konqueror Bookmark Folders", () => {
  it("bookmarks the invoking window's ordered directory, URL, and file tabs into one atomic root Folder", () => {
    const { applications, storage } = renderKonquerors([documentsRequest]);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");
    openBlankTab(application);
    navigate(application, "/home/user");
    openBlankTab(application);
    navigate(application, "https://example.com/path");
    openBlankTab(application);
    navigate(application, "/home/user/Documents/Notes.txt");

    openBookmarks(application);
    click(findMenuAction("Bookmark Tabs as Folder..."));
    const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!input) throw new Error("Bookmark Tabs dialog missing");
    setInput(input, "Session");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);

    const session = getBookmarks().rootChildren[0];
    if (!session || session.type !== "folder") throw new Error("Session folder missing");
    expect(session).toMatchObject({ id: "bookmark-1", name: "Session" });
    expect(session.children.map((node) => node.type === "bookmark" ? [node.name, node.location] : null)).toEqual([
      ["Documents", "/home/user/Documents"],
      ["user", "/home/user"],
      ["example.com", "https://example.com/path"],
      ["Notes.txt", "/home/user/Documents/Notes.txt"],
    ]);
    expect(session.children.every((node) => node.type === "bookmark" && node.comment === "" && node.visitCount === 0 && node.firstViewed === null && node.lastViewed === null)).toBe(true);
    expect(new Set(session.children.map((node) => node.id)).size).toBe(4);
    expect(createKonquerorBookmarksStorage(() => storage).load()).toMatchObject({
      type: "loaded",
      bookmarks: { rootChildren: [expect.objectContaining({ name: "Session", children: [
        expect.objectContaining({ location: "/home/user/Documents", visitCount: 0 }),
        expect.objectContaining({ location: "/home/user", visitCount: 0 }),
        expect.objectContaining({ location: "https://example.com/path", visitCount: 0 }),
        expect.objectContaining({ location: "/home/user/Documents/Notes.txt", visitCount: 0 }),
      ] })] },
    });
  });

  it("allows Bookmark Tabs as Folder for one tab and renders its bookmark leaf before folder commands", () => {
    const { applications } = renderKonquerors([documentsRequest]);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    click(findMenuAction("Bookmark Tabs as Folder..."));
    const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!input) throw new Error("Bookmark Tabs dialog missing");
    setInput(input, "Single Session");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);

    const session = getBookmarks().rootChildren[0];
    if (!session || session.type !== "folder") throw new Error("Single Session missing");
    expect(session.children).toHaveLength(1);
    openBookmarks(application);
    openFolderSubmenu(session.id);
    const menu = [...container.querySelectorAll<HTMLElement>("[aria-label='Single Session submenu']")].at(-1);
    expect(menu?.textContent).toContain("Add Bookmark");
    expect(menu?.textContent).toContain("Documents");
  });

  it("keeps tabs-folder dialog validation isolated from Ctrl+B root Add Bookmark", () => {
    const { applications } = renderKonquerors([documentsRequest]);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    click(findMenuAction("Bookmark Tabs as Folder..."));
    const cancelledInput = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!cancelledInput) throw new Error("Bookmark Tabs dialog missing");
    setInput(cancelledInput, "Cancelled");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "Cancel") ?? null);
    expect(getBookmarks().rootChildren).toEqual([]);

    openBookmarks(application);
    click(findMenuAction("Bookmark Tabs as Folder..."));
    const emptyInput = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!emptyInput) throw new Error("Bookmark Tabs dialog missing");
    setInput(emptyInput, "   ");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);
    expect(getBookmarks().rootChildren).toEqual([]);

    setInput(emptyInput, "Session");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);
    const content = application.querySelector<HTMLElement>(".konqueror-content");
    if (!content) throw new Error("Konqueror content missing");
    act(() => content.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey: true, key: "b" })));
    expect(getBookmarks().rootChildren.map((node) => node.type)).toEqual(["folder", "bookmark"]);
    expect(getBookmarks().rootChildren[1]).toMatchObject({ location: "/home/user/Documents" });
  });

  it("creates a trimmed root Bookmark Folder and persists it through the shared provider", () => {
    const { applications, storage } = renderKonquerors([documentsRequest]);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    click(findMenuAction("New Bookmark Folder..."));
    const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!input) throw new Error("Bookmark Folder dialog missing");
    setInput(input, "  Projects  ");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);

    expect(getBookmarks().rootChildren).toEqual([expect.objectContaining({ id: "bookmark-1", type: "folder", name: "Projects", children: [] })]);
    expect([...storage.values.values()][0]).toContain('"name":"Projects"');
  });

  it("captures the exact nested parent when creating a Folder through recursive submenus", () => {
    const { applications, storage } = renderKonquerors([documentsRequest], {
      rootChildren: [{ id: "folder-a", type: "folder", name: "A", children: [{ id: "folder-b", type: "folder", name: "B", children: [] }] }],
    });
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    openFolderSubmenu("folder-a");
    openFolderSubmenu("folder-b");
    const submenuB = [...container.querySelectorAll<HTMLElement>("[aria-label='B submenu']")].at(-1);
    click([...submenuB?.querySelectorAll<HTMLButtonElement>("button[role='menuitem']") ?? []]
      .find((button) => button.textContent?.trim() === "New Bookmark Folder...") ?? null);
    const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!input) throw new Error("Bookmark Folder dialog missing");
    setInput(input, "C");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);

    expect(getBookmarks().rootChildren[0]).toMatchObject({
      id: "folder-a",
      children: [{ id: "folder-b", children: [expect.objectContaining({ type: "folder", name: "C" })] }],
    });
    expect(createKonquerorBookmarksStorage(() => storage).load()).toMatchObject({
      type: "loaded",
      bookmarks: { rootChildren: [{ id: "folder-a", children: [{ id: "folder-b", children: [expect.objectContaining({ name: "C" })] }] }] },
    });
  });

  it("does not mutate the tree for Cancel or a whitespace-only folder name", () => {
    const { applications } = renderKonquerors([documentsRequest]);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    click(findMenuAction("New Bookmark Folder..."));
    const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!input) throw new Error("Bookmark Folder dialog missing");
    setInput(input, "Ignored");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "Cancel") ?? null);
    expect(getBookmarks().rootChildren).toEqual([]);

    openBookmarks(application);
    click(findMenuAction("New Bookmark Folder..."));
    const secondInput = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!secondInput) throw new Error("Bookmark Folder dialog missing");
    setInput(secondInput, "   ");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);
    expect(getBookmarks().rootChildren).toEqual([]);
    expect(container.querySelector("[role='alert']")?.textContent).toContain("Enter a folder name.");
  });

  it("allows duplicate Folder names at the root while assigning distinct stable IDs", () => {
    const { applications } = renderKonquerors([documentsRequest]);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    for (const name of ["Projects", "Projects"]) {
      openBookmarks(application);
      click(findMenuAction("New Bookmark Folder..."));
      const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
      if (!input) throw new Error("Bookmark Folder dialog missing");
      setInput(input, name);
      click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);
    }

    expect(getBookmarks().rootChildren.map((node) => node.name)).toEqual(["Projects", "Projects"]);
    expect(getBookmarks().rootChildren.map((node) => node.id)).toEqual(["bookmark-1", "bookmark-2"]);
  });

  it("captures a deep Folder target and tab snapshot for Bookmark Tabs as Folder", () => {
    const { applications } = renderKonquerors([documentsRequest], {
      rootChildren: [{ id: "a", type: "folder", name: "A", children: [{ id: "b", type: "folder", name: "B", children: [{ id: "c", type: "folder", name: "C", children: [] }] }] }],
    });
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    openFolderSubmenu("a");
    openFolderSubmenu("b");
    openFolderSubmenu("c");
    const menuC = [...container.querySelectorAll<HTMLElement>("[aria-label='C submenu']")].at(-1);
    click([...menuC?.querySelectorAll<HTMLButtonElement>("button[role='menuitem']") ?? []]
      .find((button) => button.textContent?.trim() === "Bookmark Tabs as Folder...") ?? null);
    const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!input) throw new Error("Bookmark Tabs dialog missing");
    setInput(input, "D");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);

    expect(getBookmarks().rootChildren[0]).toMatchObject({ children: [{ id: "b", children: [{ id: "c", children: [expect.objectContaining({ name: "D", type: "folder", children: [expect.objectContaining({ location: "/home/user/Documents" })] })] }] }] });
  });

  it("publishes nested Folder mutations through one desktop Provider to every Konqueror instance", () => {
    const { applications } = renderKonquerors([documentsRequest, homeRequest], {
      rootChildren: [{ id: "projects", type: "folder", name: "Projects", children: [] }],
    });
    const [first, second] = applications;
    if (!first || !second) throw new Error("Konqueror missing");

    openBookmarks(second);
    openFolderSubmenu("projects");
    const projectsMenu = [...container.querySelectorAll<HTMLElement>("[aria-label='Projects submenu']")].at(-1);
    click([...projectsMenu?.querySelectorAll<HTMLButtonElement>("button[role='menuitem']") ?? []]
      .find((button) => button.textContent?.trim() === "New Bookmark Folder...") ?? null);
    const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!input) throw new Error("Bookmark Folder dialog missing");
    setInput(input, "Robotics");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);

    openBookmarks(first);
    openFolderSubmenu("projects");
    expect(container.querySelector("button[data-submenu-id='bookmark-folder-bookmark-1']")?.textContent).toContain("Robotics");
  });

  it("uses each invoking instance's tab snapshot while publishing both sessions to the shared Provider", () => {
    const { applications } = renderKonquerors([documentsRequest, homeRequest]);
    const [first, second] = applications;
    if (!first || !second) throw new Error("Konqueror missing");
    openBlankTab(second);
    navigate(second, "https://example.com");
    openBlankTab(second);
    navigate(second, "/home/user/Music");

    openBookmarks(second);
    click(findMenuAction("Bookmark Tabs as Folder..."));
    const input = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!input) throw new Error("Bookmark Tabs dialog missing");
    setInput(input, "B Session");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);

    const sessionB = getBookmarks().rootChildren[0];
    if (!sessionB || sessionB.type !== "folder") throw new Error("B Session missing");
    expect(sessionB.children.map((node) => node.type === "bookmark" ? node.location : null)).toEqual(["/home/user", "https://example.com/", "/home/user/Music"]);

    openBookmarks(first);
    click(findMenuAction("Bookmark Tabs as Folder..."));
    const secondInput = container.querySelector<HTMLInputElement>(".konqueror-dialog-input");
    if (!secondInput) throw new Error("Bookmark Tabs dialog missing");
    setInput(secondInput, "A Session");
    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")].find((button) => button.textContent === "OK") ?? null);

    expect(getBookmarks().rootChildren.map((node) => node.name)).toEqual(["B Session", "A Session"]);
    expect((getBookmarks().rootChildren[1] as Extract<KonquerorBookmarkTree["rootChildren"][number], { type: "folder" }>).children.map((node) => node.type === "bookmark" ? node.location : null)).toEqual(["/home/user/Documents"]);
  });

  it("adds the triggering Konqueror active tab to the selected Folder while root Add Bookmark remains root-targeted", () => {
    const { applications } = renderKonquerors([documentsRequest, homeRequest], {
      rootChildren: [{ id: "work", type: "folder", name: "Work", children: [] }],
    });
    const [first, second] = applications;
    if (!first || !second) throw new Error("Konqueror missing");

    openBookmarks(second);
    openFolderSubmenu("work");
    const workMenu = [...container.querySelectorAll<HTMLElement>("[aria-label='Work submenu']")].at(-1);
    click([...workMenu?.querySelectorAll<HTMLButtonElement>("button[role='menuitem']") ?? []]
      .find((button) => button.textContent?.trim() === "Add Bookmark") ?? null);
    expect(getBookmarks().rootChildren[0]).toMatchObject({ children: [expect.objectContaining({ location: "/home/user", name: "user", visitCount: 0, firstViewed: null, lastViewed: null })] });

    const content = first.querySelector<HTMLElement>(".konqueror-content");
    if (!content) throw new Error("Konqueror content missing");
    act(() => content.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey: true, key: "b" })));
    expect(getBookmarks().rootChildren.at(-1)).toMatchObject({ type: "bookmark", location: "/home/user/Documents" });
  });
});
