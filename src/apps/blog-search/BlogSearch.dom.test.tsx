// @vitest-environment jsdom
import { act, StrictMode, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createVfsTextFile, moveVfsNodeToTrash, restoreVfsNodeFromTrash, writeVfsTextFile } from "../../vfs/mutations";
import { resolveVfsPath } from "../../vfs/queries";
import type { VfsFileNode, VfsPublicationMetadata, VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import { VfsContext } from "../../vfs/VfsContext";
import { BlogSearch } from "./BlogSearch";

const now = "2026-09-14T00:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let setFixtureState: Dispatch<SetStateAction<VfsState>>;
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;

const addPublished = (
  state: VfsState,
  name: string,
  title: string,
  publication: VfsPublicationMetadata,
  body = "BODYONLYNEBULA",
  mimeType = "text/markdown",
): { readonly state: VfsState; readonly nodeId: string } => {
  const created = createVfsTextFile(state, "/home/user/Documents", name, body, { now, mimeType });
  if (!created.ok) throw new Error("Expected published fixture creation to succeed.");
  const article = resolveVfsPath(created.state, `/home/user/Documents/${name}`);
  if (!article.ok || article.value.kind !== "file") throw new Error("Published fixture missing.");

  return {
    nodeId: article.value.id,
    state: {
      ...created.state,
      nodesById: {
        ...created.state.nodesById,
        [article.value.id]: { ...article.value, displayName: title, publication },
      },
    },
  };
};

function Fixture({ children, initialState }: { readonly children: ReactNode; readonly initialState: VfsState }) {
  const [state, setState] = useState(initialState);
  setFixtureState = setState;
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const renderSearch = (initialState: VfsState, launchRequest: ApplicationLaunchRequest | null = null) => {
  launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "opened"), launchNewApplicationInstance }}>
          <Fixture initialState={initialState}><BlogSearch launchRequest={launchRequest} /></Fixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

const replaceFile = (state: VfsState, file: VfsFileNode): VfsState => ({
  ...state,
  nodesById: { ...state.nodesById, [file.id]: file },
});

const setQuery = (value: string) => {
  const input = container.querySelector<HTMLInputElement>("#blog-search-query");
  if (!input) throw new Error("Search input missing.");
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("Blog Search live published catalog", () => {
  it("uses one push then replace-only canonical URL updates for user input and removes only an active Search route on clear", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent(), "history.md", "History", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "history",
    });
    window.history.replaceState(null, "", "#/blog/an-article");
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderSearch(fixture.state);

    setQuery("k");
    expect(window.location.hash).toBe("#/blog/search/k");
    expect(pushState).toHaveBeenCalledTimes(1);
    setQuery("kd");
    setQuery("kde");
    expect(window.location.hash).toBe("#/blog/search/kde");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledTimes(2);

    setQuery("  kde   ");
    expect(window.location.hash).toBe("#/blog/search/kde");
    expect(replaceState).toHaveBeenCalledTimes(2);
    const clear = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Clear");
    if (!clear) throw new Error("Clear control missing.");
    act(() => clear.click());
    expect(window.location.hash).toBe("");
    expect(replaceState).toHaveBeenCalledTimes(3);

    window.history.replaceState(null, "", "#/blog/an-article");
    setQuery(" ");
    expect(window.location.hash).toBe("#/blog/an-article");
  });

  it("accepts a routed query request without URL feedback and updates an existing Search instance only for a newer request", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent(), "intent.md", "Robot Search", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "intent",
    }, "robot body");
    window.history.replaceState(null, "", "#/blog/search/robot");
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderSearch(fixture.state, { requestId: 1, intent: { type: "open-blog-search", query: "robot" } });
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("robot");
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();

    renderSearch(fixture.state, { requestId: 2, intent: { type: "open-blog-search", query: "KDE robot" } });
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("KDE robot");
    expect(container.querySelectorAll(".blog-search")).toHaveLength(1);
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("renders safe match explanations without changing result membership or catalog order", () => {
    let first = addPublished(createVfsTestStateWithoutRepositoryContent(), "first.md", "KDE Robot Journal", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "first", summary: "Classic desktop experiments", tags: ["Web", "KDE 3", "Qt"],
    }, `${"intro ".repeat(34)}The ROBOT navigation system is visible ${"tail ".repeat(34)}`);
    const second = addPublished(first.state, "second.md", "Other Article", {
      status: "published", publishedAt: "2026-09-17T07:00:00.000Z", slug: "second", tags: ["Web"],
    }, "robot body");
    first = { ...first, state: second.state };
    renderSearch(second.state);

    setQuery("kde web robot");
    expect([...container.querySelectorAll(".blog-search__article-title")].map((element) => element.textContent)).toEqual(["KDE Robot Journal"]);
    const row = container.querySelector(`[data-blog-search-node-id='${first.nodeId}']`);
    if (!row) throw new Error("Search explanation fixture missing.");
    expect([...row.querySelectorAll(".blog-search__match")].map((element) => element.textContent)).toEqual(["KDE", "Robot", "Web", "KDE", "ROBOT"]);
    expect(row.querySelector(".blog-search__snippet")?.textContent).toContain("ROBOT");
    expect(row.querySelector(".blog-search__snippet")?.textContent).toMatch(/^…/u);
    expect(row.querySelector(".blog-search__snippet")?.textContent).toMatch(/…$/u);
    const matchingTags = row.querySelector(".blog-search__matched-tags");
    expect(matchingTags?.textContent).toBe("Matched tags: Web, KDE 3");
    expect(matchingTags?.querySelector("a, button")).toBeNull();
  });

  it("shows metadata context without a filler body snippet and refreshes title, summary, tag, and body highlights with the query", () => {
    let fixture = addPublished(createVfsTestStateWithoutRepositoryContent(), "metadata.md", "Plain Title", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "metadata", summary: "KDE summary", tags: ["Web"],
    }, "Unrelated body content");
    const bodyOnly = addPublished(fixture.state, "body.md", "Body Only", {
      status: "published", publishedAt: "2026-09-17T07:00:00.000Z", slug: "body",
    }, "Visible BODYONLYORBIT context");
    fixture = { ...fixture, state: bodyOnly.state };
    renderSearch(bodyOnly.state);

    setQuery("kde");
    const metadataRow = container.querySelector(`[data-blog-search-node-id='${fixture.nodeId}']`);
    expect(metadataRow?.querySelector(".blog-search__summary .blog-search__match")?.textContent).toBe("KDE");
    expect(metadataRow?.querySelector(".blog-search__snippet")).toBeNull();
    expect(metadataRow?.querySelector(".blog-search__matched-tags")).toBeNull();

    setQuery("web");
    expect(metadataRow?.querySelector(".blog-search__matched-tags .blog-search__match")?.textContent).toBe("Web");
    expect(metadataRow?.querySelector(".blog-search__snippet")).toBeNull();

    setQuery("BODYONLYORBIT");
    const bodyRow = container.querySelector(`[data-blog-search-node-id='${bodyOnly.nodeId}']`);
    expect(bodyRow?.querySelector(".blog-search__article-title .blog-search__match")).toBeNull();
    expect(bodyRow?.querySelector(".blog-search__snippet .blog-search__match")?.textContent).toBe("BODYONLYORBIT");
    expect(bodyRow?.querySelector(".blog-search__matched-tags")).toBeNull();
  });

  it("starts inactive, searches metadata and visible body text live, counts results, and clears without listing the catalog", () => {
    let fixture = addPublished(createVfsTestStateWithoutRepositoryContent(), "a.md", "KDE Desktop Journal", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "article-a", summary: "Classic desktop reconstruction", tags: ["Web"],
    });
    fixture = addPublished(fixture.state, "b.md", "Robot Journal", {
      status: "published", publishedAt: "2026-09-17T07:00:00.000Z", slug: "article-b", summary: "Humanoid platform notes", tags: ["机器人"],
    });
    renderSearch(fixture.state);

    expect(container.textContent).toContain("Enter a search term to find published articles.");
    expect(container.querySelectorAll("[data-blog-search-node-id]")).toHaveLength(0);

    setQuery("  kde  web ");
    expect(container.querySelectorAll("[data-blog-search-node-id]")).toHaveLength(1);
    expect(container.textContent).toContain("1 result");
    expect(container.textContent).toContain("KDE Desktop Journal");

    setQuery("humanoid");
    expect(container.textContent).toContain("Robot Journal");
    setQuery("机器人");
    expect(container.textContent).toContain("Robot Journal");
    setQuery("BODYONLYNEBULA");
    expect(container.textContent).toContain("2 results");

    const clear = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Clear");
    if (!clear) throw new Error("Clear control missing.");
    act(() => clear.click());
    expect(container.textContent).toContain("Enter a search term to find published articles.");
    expect(container.querySelectorAll("[data-blog-search-node-id]")).toHaveLength(0);
  });

  it("updates a body-only result from the current runtime VFS body without replacing the query", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent(), "live-body.md", "Live Body", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "live-body",
    }, "Before update");
    renderSearch(fixture.state);
    setQuery("NEWLIVEBODYTOKEN");
    expect(container.textContent).toContain("No published articles match your search.");

    const written = writeVfsTextFile(fixture.state, "/home/user/Documents/live-body.md", "Before update NEWLIVEBODYTOKEN", { now });
    if (!written.ok) throw new Error("Expected live body write to succeed.");
    let state = written.state;
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Live Body");
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("NEWLIVEBODYTOKEN");

    const removed = writeVfsTextFile(state, "/home/user/Documents/live-body.md", "After removal", { now });
    if (!removed.ok) throw new Error("Expected live body removal to succeed.");
    state = removed.state;
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("No published articles match your search.");
  });

  it("keeps body matches subject to catalog-controlled Trash, Restore, draft, and republish lifecycle", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent(), "lifecycle.md", "Lifecycle", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "lifecycle",
    }, "BODYLIFECYCLETOKEN");
    renderSearch(fixture.state);
    setQuery("BODYLIFECYCLETOKEN");
    expect(container.textContent).toContain("Lifecycle");

    const trashed = moveVfsNodeToTrash(fixture.state, "/home/user/Documents/lifecycle.md", { now });
    if (!trashed.ok) throw new Error("Expected body fixture Trash mutation to succeed.");
    act(() => setFixtureState(trashed.state));
    expect(container.textContent).toContain("No published articles match your search.");

    const restored = restoreVfsNodeFromTrash(trashed.state, trashed.value.id, { now });
    if (!restored.ok) throw new Error("Expected body fixture Restore mutation to succeed.");
    act(() => setFixtureState(restored.state));
    expect(container.textContent).toContain("Lifecycle");

    const restoredNode = restored.state.nodesById[fixture.nodeId];
    if (!restoredNode || restoredNode.kind !== "file") throw new Error("Restored lifecycle fixture missing.");
    const draft = replaceFile(restored.state, { ...restoredNode, publication: { status: "draft" } });
    act(() => setFixtureState(draft));
    expect(container.textContent).toContain("No published articles match your search.");

    const republished = replaceFile(draft, { ...restoredNode, publication: { ...restoredNode.publication!, status: "published" } });
    act(() => setFixtureState(republished));
    expect(container.textContent).toContain("Lifecycle");
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("BODYLIFECYCLETOKEN");
  });

  it("preserves catalog order and its current query through metadata and publication lifecycle updates", () => {
    let first = addPublished(createVfsTestStateWithoutRepositoryContent(), "first.md", "Zebra", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "first", tags: ["Qt"],
    });
    const second = addPublished(first.state, "second.md", "Alpha", {
      status: "published", publishedAt: "2026-09-17T07:00:00.000Z", slug: "second", summary: "Qt notes",
    });
    first = { ...first, state: second.state };
    renderSearch(second.state);
    setQuery("qt");
    expect([...container.querySelectorAll(".blog-search__article-title")].map((element) => element.textContent)).toEqual(["Zebra", "Alpha"]);

    const firstNode = second.state.nodesById[first.nodeId];
    if (!firstNode || firstNode.kind !== "file") throw new Error("First fixture missing.");
    const withoutQt = { ...second.state, nodesById: { ...second.state.nodesById, [first.nodeId]: { ...firstNode, publication: { ...firstNode.publication!, tags: [] } } } };
    act(() => setFixtureState(withoutQt));
    expect((container.querySelector<HTMLInputElement>("#blog-search-query")?.value)).toBe("qt");
    expect([...container.querySelectorAll(".blog-search__article-title")].map((element) => element.textContent)).toEqual(["Alpha"]);

    const trashed = moveVfsNodeToTrash(withoutQt, "/home/user/Documents/second.md", { now });
    if (!trashed.ok) throw new Error("Expected Trash mutation to succeed.");
    act(() => setFixtureState(trashed.state));
    expect(container.textContent).toContain("No published articles match your search.");
    const restored = restoreVfsNodeFromTrash(trashed.state, trashed.value.id, { now });
    if (!restored.ok) throw new Error("Expected Restore mutation to succeed.");
    act(() => setFixtureState(restored.state));
    expect(container.textContent).toContain("Alpha");

    const restoredFirst = restored.state.nodesById[first.nodeId];
    const restoredSecond = restored.state.nodesById[second.nodeId];
    if (!restoredFirst || restoredFirst.kind !== "file" || !restoredSecond || restoredSecond.kind !== "file") throw new Error("Restored search fixtures missing.");
    const reordered: VfsState = {
      ...restored.state,
      nodesById: {
        ...restored.state.nodesById,
        [restoredFirst.id]: { ...restoredFirst, publication: { ...restoredFirst.publication!, tags: ["Qt"] } },
        [restoredSecond.id]: { ...restoredSecond, publication: { ...restoredSecond.publication!, publishedAt: "2026-09-17T09:00:00.000Z" } },
      },
    };
    act(() => setFixtureState(reordered));
    expect([...container.querySelectorAll(".blog-search__article-title")].map((element) => element.textContent)).toEqual(["Alpha", "Zebra"]);
  });

  it("recalculates title, summary, tag, draft, republish, and catalog-order changes without replacing the query", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent(), "live.md", "Plain", {
      status: "published", publishedAt: "2026-09-17T07:00:00.000Z", slug: "live",
    });
    renderSearch(fixture.state);
    setQuery("kde");
    const node = fixture.state.nodesById[fixture.nodeId];
    if (!node || node.kind !== "file") throw new Error("Live fixture missing.");

    let current: VfsFileNode = { ...node, displayName: "KDE Title" };
    let state = replaceFile(fixture.state, current);
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("KDE Title");

    current = { ...current, displayName: "Plain", publication: { ...current.publication!, summary: "KDE summary" } };
    state = replaceFile(state, current);
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Plain");

    current = { ...current, publication: { status: "published", publishedAt: "2026-09-17T07:00:00.000Z", slug: "live", tags: ["KDE"] } };
    state = replaceFile(state, current);
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Plain");

    current = { ...current, publication: { ...current.publication!, tags: [] } };
    state = replaceFile(state, current);
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("No published articles match your search.");

    current = { ...current, publication: { status: "draft" } };
    state = replaceFile(state, current);
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("No published articles match your search.");

    current = { ...current, publication: { status: "published", publishedAt: "2026-09-18T08:00:00.000Z", slug: "live", tags: ["KDE"] } };
    state = replaceFile(state, current);
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Plain");
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("kde");
  });

  it("uses canonical anchors for slugged entries, leaves modified clicks native, and keeps v4 entries on the nodeId fallback", () => {
    let slugged = addPublished(createVfsTestStateWithoutRepositoryContent(), "slugged.md", "Slugged", {
      status: "published", publishedAt: "2026-09-17T08:00:00.000Z", slug: "current-slug", aliases: ["old-slug"],
    });
    const legacy = addPublished(slugged.state, "legacy.md", "Legacy", { status: "published", publishedAt: "2026-09-17T07:00:00.000Z" });
    slugged = { ...slugged, state: legacy.state };
    renderSearch(legacy.state);
    setQuery("slug");
    const permalink = container.querySelector<HTMLAnchorElement>(`[data-blog-search-node-id='${slugged.nodeId}'] .blog-search__article-title`);
    expect(permalink?.getAttribute("href")).toBe("#/blog/current-slug");
    expect(container.innerHTML).not.toContain("old-slug");

    act(() => permalink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })));
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();

    setQuery("legacy");
    const legacyButton = container.querySelector<HTMLButtonElement>(`[data-blog-search-node-id='${legacy.nodeId}'] .blog-search__article-title`);
    expect(legacyButton?.tagName).toBe("BUTTON");
    act(() => legacyButton?.click());
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: legacy.nodeId } });
  });
});
