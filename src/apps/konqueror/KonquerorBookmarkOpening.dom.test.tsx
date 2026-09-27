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

const getBookmarks = () => JSON.parse(container.querySelector("[data-testid='bookmarks']")?.textContent ?? "{}") as KonquerorBookmarkTree;

const findMenu = (application: HTMLElement, label: string) =>
  [...application.querySelectorAll<HTMLButtonElement>(".konqueror-menuitem")].find((button) => button.textContent === label) ?? null;

const openBookmarks = (application: HTMLElement) => click(findMenu(application, "Bookmarks"));

const findMenuAction = (scope: ParentNode, label: string) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((button) => button.textContent?.trim() === label) ?? null;

const openFolderSubmenu = (folderId: string) => click(container.querySelector<HTMLButtonElement>(`button[data-submenu-id='bookmark-folder-${folderId}']`));

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

const getLocation = (application: HTMLElement) => application.querySelector<HTMLInputElement>("#konqueror-location")?.value;

const getBookmark = (id: string) => {
  const find = (nodes: KonquerorBookmarkTree["rootChildren"]): Extract<KonquerorBookmarkTree["rootChildren"][number], { readonly type: "bookmark" }> | null => {
    for (const node of nodes) {
      if (node.type === "bookmark" && node.id === id) return node;
      if (node.type === "folder") {
        const nested = find(node.children);
        if (nested !== null) return nested;
      }
    }
    return null;
  };
  return find(getBookmarks().rootChildren);
};

const renderKonquerors = (
  requests: readonly ApplicationLaunchRequest[],
  initialBookmarks: KonquerorBookmarkTree,
  now: () => string = () => new Date().toISOString(),
) => {
  const storage = createMemoryStorage();
  const launchApplication = vi.fn((): LaunchApplicationResult => "already-active");
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{
          launchApplication,
          launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened"),
        }}>
          <KonquerorBookmarksProvider initialBookmarks={initialBookmarks} storage={createKonquerorBookmarksStorage(() => storage)} now={now}>
            <SharedVfsFixture>
              {requests.map((request, index) => (
                <Konqueror key={index} windowId={`bookmark-open-window-${index + 1}`} launchRequest={request} isActive focusRequestId={index + 1} />
              ))}
              <BookmarkProbe />
            </SharedVfsFixture>
          </KonquerorBookmarksProvider>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
  return { applications: [...container.querySelectorAll<HTMLElement>(".konqueror-application")], storage, launchApplication };
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

describe("Konqueror Bookmark opening", () => {
  it("launches the singleton Bookmark Editor from the exact root menu position", () => {
    const { applications, launchApplication } = renderKonquerors([documentsRequest], { rootChildren: [] });
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    const rootItems = [...container.querySelectorAll<HTMLElement>("[aria-label='Bookmarks menu'] button[role='menuitem']")];
    expect(rootItems.map((item) => item.textContent?.trim())).toEqual(["Add BookmarkCtrl+B", "Bookmark Tabs as Folder...", "Edit Bookmarks", "New Bookmark Folder..."]);
    click(findMenuAction(container, "Edit Bookmarks"));
    expect(launchApplication).toHaveBeenCalledTimes(1);
    expect(launchApplication).toHaveBeenCalledWith("bookmark-editor");
  });

  it("opens directory, file, and URL leaves through the current tab's location pipeline", () => {
    const { applications } = renderKonquerors([documentsRequest], {
      rootChildren: [
        { id: "documents", type: "bookmark", name: "Documents", location: "/home/user/Documents", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
        { id: "notes", type: "bookmark", name: "Notes.txt", location: "/home/user/Documents/Notes.txt", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
        { id: "example", type: "bookmark", name: "Example", location: "https://example.com/path", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
      ],
    });
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    for (const [name, location, id] of [["Documents", "/home/user/Documents", "documents"], ["Notes.txt", "/home/user/Documents/Notes.txt", "notes"], ["Example", "https://example.com/path", "example"]] as const) {
      openBookmarks(application);
      const leaf = findMenuAction(container, name);
      expect(leaf?.getAttribute("aria-haspopup")).toBeNull();
      click(leaf);
      expect(getLocation(application)).toBe(location);
      expect(getBookmark(id)?.visitCount).toBe(1);
      expect(container.querySelector("[aria-label='Bookmarks menu']")).toBeNull();
    }
  });

  it("records accepted visits by stable Bookmark ID and preserves visit timestamps", () => {
    const timestamps = ["2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"];
    let timestampIndex = 0;
    const { applications, storage } = renderKonquerors([documentsRequest], {
      rootChildren: [
        { id: "first", type: "bookmark", name: "First", location: "/home/user", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
        { id: "second", type: "bookmark", name: "Second", location: "/home/user", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
      ],
    }, () => timestamps[timestampIndex++]!);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    click(findMenuAction(container, "First"));
    openBookmarks(application);
    click(findMenuAction(container, "First"));
    openBookmarks(application);
    click(findMenuAction(container, "Second"));

    expect(getBookmark("first")).toMatchObject({ firstViewed: timestamps[0], lastViewed: timestamps[1], visitCount: 2 });
    expect(getBookmark("second")).toMatchObject({ firstViewed: timestamps[2], lastViewed: timestamps[2], visitCount: 1 });
    expect(createKonquerorBookmarksStorage(() => storage).load()).toMatchObject({
      type: "loaded",
      bookmarks: { rootChildren: expect.arrayContaining([expect.objectContaining({ id: "first", firstViewed: timestamps[0], lastViewed: timestamps[1], visitCount: 2 })]) },
    });
  });

  it("does not record visits for manual navigation or rejected bookmark locations", () => {
    const { applications } = renderKonquerors([documentsRequest], {
      rootChildren: [
        { id: "manual", type: "bookmark", name: "Manual", location: "/home/user", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
        { id: "invalid", type: "bookmark", name: "Invalid", location: "unsupported:bookmark", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
      ],
    });
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    navigate(application, "/home/user");
    expect(getBookmark("manual")?.visitCount).toBe(0);
    openBookmarks(application);
    click(findMenuAction(container, "Invalid"));
    expect(getBookmark("invalid")?.visitCount).toBe(0);
  });

  it("keeps navigation local while visit metadata is shared across Konqueror instances", () => {
    const { applications } = renderKonquerors([homeRequest, documentsRequest], {
      rootChildren: [{ id: "shared", type: "bookmark", name: "Shared", location: "https://example.com", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 }],
    });
    const [applicationA, applicationB] = applications;
    if (!applicationA || !applicationB) throw new Error("Konqueror instances missing");

    openBookmarks(applicationB);
    click(findMenuAction(container, "Shared"));
    expect(getLocation(applicationB)).toBe("https://example.com/");
    expect(getLocation(applicationA)).toBe("/home/user");
    expect(getBookmark("shared")?.visitCount).toBe(1);

    openBookmarks(applicationA);
    click(findMenuAction(container, "Shared"));
    expect(getLocation(applicationA)).toBe("https://example.com/");
    expect(getBookmark("shared")?.visitCount).toBe(2);
  });

  it("opens a deep Bookmark leaf while preserving the recursive folder action surface", () => {
    const { applications } = renderKonquerors([documentsRequest], {
      rootChildren: [{
        id: "a",
        type: "folder",
        name: "A",
        children: [{ id: "b", type: "folder", name: "B", children: [{ id: "c", type: "folder", name: "C", children: [
          { id: "deep", type: "bookmark", name: "Deep", location: "/home/user", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
        ] }] }],
      }],
    });
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    openBookmarks(application);
    openFolderSubmenu("a");
    openFolderSubmenu("b");
    openFolderSubmenu("c");
    click(findMenuAction(container, "Deep"));
    expect(getLocation(application)).toBe("/home/user");
    expect(getBookmark("deep")?.visitCount).toBe(1);
  });
});
