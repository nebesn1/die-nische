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

let container: HTMLDivElement;
let reactRoot: Root;

const homeRequest: ApplicationLaunchRequest = { requestId: 1, intent: { type: "open-special-location", location: "home" } };
const documentsRequest: ApplicationLaunchRequest = { requestId: 2, intent: { type: "open-special-location", location: "documents" } };
const notesRequest: ApplicationLaunchRequest = { requestId: 3, intent: { type: "open-file", nodeId: "vfs-content-e594a065214576326cb903a5" } };

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

const getBookmarks = () => JSON.parse(container.querySelector("[data-testid='bookmarks']")?.textContent ?? "{}") as {
  readonly rootChildren: readonly Record<string, unknown>[];
};

const findMenu = (application: HTMLElement, label: string) =>
  [...application.querySelectorAll<HTMLButtonElement>(".konqueror-menuitem")].find((button) => button.textContent === label) ?? null;

const invokeAddBookmarkFromMenu = (application: HTMLElement) => {
  click(findMenu(application, "Bookmarks"));
  click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
    .find((button) => button.textContent?.includes("Add Bookmark")) ?? null);
};

const invokeAddBookmarkShortcut = (application: HTMLElement) => {
  const content = application.querySelector<HTMLElement>(".konqueror-content");
  if (!content) throw new Error("Konqueror content missing");
  act(() => content.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey: true, key: "b" })));
};

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

const renderKonquerors = (requests: readonly ApplicationLaunchRequest[]) => {
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
            storage={createKonquerorBookmarksStorage(() => storage)}
            createNodeId={() => `bookmark-${nextBookmarkId++}`}
          >
            <SharedVfsFixture>
              {requests.map((request, index) => (
                <Konqueror key={index} windowId={`bookmark-window-${index + 1}`} launchRequest={request} isActive focusRequestId={index + 1} />
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

describe("Konqueror Add Bookmark", () => {
  it("adds the active directory through Bookmarks with default comment and untouched visit metadata", () => {
    const { applications, storage } = renderKonquerors([documentsRequest]);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");

    invokeAddBookmarkFromMenu(application);

    expect(getBookmarks().rootChildren).toEqual([
      expect.objectContaining({
        id: "bookmark-1",
        type: "bookmark",
        name: "Documents",
        location: "/home/user/Documents",
        comment: "",
        firstViewed: null,
        lastViewed: null,
        visitCount: 0,
      }),
    ]);
    expect([...storage.values.values()][0]).toContain('"location":"/home/user/Documents"');
  });

  it("adds a file bookmark through the same active-tab command", () => {
    const file = renderKonquerors([notesRequest]);
    const fileApplication = file.applications[0];
    if (!fileApplication) throw new Error("Konqueror missing");
    invokeAddBookmarkFromMenu(fileApplication);
    expect(getBookmarks().rootChildren[0]).toMatchObject({ name: "Notes.txt", location: "/home/user/Documents/Notes.txt" });
  });

  it("adds a canonical URL bookmark through the same active-tab command", () => {
    const { applications } = renderKonquerors([homeRequest]);
    const webApplication = applications[0];
    if (!webApplication) throw new Error("Konqueror missing");
    navigate(webApplication, "https://example.com/path");
    invokeAddBookmarkFromMenu(webApplication);
    expect(getBookmarks().rootChildren[0]).toMatchObject({ name: "example.com", location: "https://example.com/path" });
  });

  it("uses the selected active tab for Ctrl+B and permits duplicate root bookmarks with distinct IDs", () => {
    const { applications } = renderKonquerors([homeRequest]);
    const application = applications[0];
    if (!application) throw new Error("Konqueror missing");
    openBlankTab(application);
    navigate(application, "/home/user/Documents");

    invokeAddBookmarkShortcut(application);
    invokeAddBookmarkShortcut(application);

    expect(getBookmarks().rootChildren).toEqual([
      expect.objectContaining({ id: "bookmark-1", location: "/home/user/Documents" }),
      expect.objectContaining({ id: "bookmark-2", location: "/home/user/Documents" }),
    ]);
  });

  it("uses the triggering Konqueror instance's active tab while sharing one desktop bookmark authority", () => {
    const { applications } = renderKonquerors([homeRequest, homeRequest]);
    const [first, second] = applications;
    if (!first || !second) throw new Error("Konqueror instances missing");
    navigate(first, "/home/user");
    navigate(second, "https://example.com/path");

    invokeAddBookmarkFromMenu(second);

    expect(getBookmarks().rootChildren).toEqual([
      expect.objectContaining({ location: "https://example.com/path", name: "example.com" }),
    ]);
  });
});
