// @vitest-environment jsdom
import { act, StrictMode, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsTextFile, moveVfsNode, moveVfsNodeToTrash, renameVfsNode, restoreVfsNodeFromTrash, writeVfsTextFile } from "../../vfs/mutations";
import { getVfsPathForNode, resolveVfsPath } from "../../vfs/queries";
import type { VfsPublicationMetadata, VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { VfsContext } from "../../vfs/VfsContext";
import { ArticleReader } from "./ArticleReader";
import { createArticleReaderOpenIntent } from "./launchIntent";

const now = "2026-09-14T00:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let setFixtureState: Dispatch<SetStateAction<VfsState>>;
let launchApplication: ReturnType<typeof vi.fn>;
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;

const expectMutation = <T,>(result: { readonly ok: true; readonly state: VfsState; readonly value: T } | { readonly ok: false }): { readonly state: VfsState; readonly value: T } => {
  if (!result.ok) throw new Error("Expected fixture mutation to succeed.");
  return result;
};

const addPublished = (state: VfsState, name: string, content: string, displayName = name, slug?: string, aliases: readonly string[] = []): VfsState => {
  const created = expectMutation(createVfsTextFile(state, "/home/user/Documents", name, content, { now, mimeType: "text/markdown" })).state;
  const resolved = resolveVfsPath(created, `/home/user/Documents/${name}`);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error("Fixture missing.");
  const publication: VfsPublicationMetadata = { status: "published", publishedAt: "2026-09-12T08:00:00.000Z", summary: "Summary", tags: ["Qt"], ...(slug === undefined ? {} : { slug }), ...(aliases.length === 0 ? {} : { aliases }) };
  return { ...created, nodesById: { ...created.nodesById, [resolved.value.id]: { ...resolved.value, displayName, publication } } };
};

const setPublication = (state: VfsState, path: string, publication: VfsPublicationMetadata): VfsState => {
  const resolved = resolveVfsPath(state, path);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error(`Missing fixture '${path}'.`);
  return { ...state, nodesById: { ...state.nodesById, [resolved.value.id]: { ...resolved.value, publication } } };
};

function Fixture({ children, initialState }: { readonly children: ReactNode; readonly initialState: VfsState }) {
  const [state, setState] = useState(initialState);
  setFixtureState = setState;
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const renderReaders = (state: VfsState, ...nodeIds: readonly string[]) => {
  launchApplication = vi.fn((): LaunchApplicationResult => "already-active");
  launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(<StrictMode><ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance }}><Fixture initialState={state}>{nodeIds.map((nodeId, index) => <ArticleReader key={nodeId} launchRequest={{ requestId: index + 1, intent: createArticleReaderOpenIntent(nodeId) }} />)}</Fixture></ApplicationLauncherContext.Provider></StrictMode>);
  });
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Article Reader live lifecycle", () => {
  it("keeps nodeId reader identity while a live authored slug changes", () => {
    let state = addPublished(createInitialVfsState(), "article.md", "Body", "Article", "first-route");
    const article = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Article missing.");
    renderReaders(state, article.value.id);
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(article.value.id);
    expect(container.querySelector(".article-reader__permalink a")?.getAttribute("href")).toBe("#/blog/first-route");

    state = { ...state, nodesById: { ...state.nodesById, [article.value.id]: {
      ...article.value,
      publication: { ...article.value.publication!, slug: "second-route" },
    } } };
    act(() => setFixtureState(state));
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(article.value.id);
    expect(container.querySelector(".article-reader__permalink a")?.getAttribute("href")).toBe("#/blog/second-route");
  });

  it("shows only the current canonical permalink when publication metadata includes aliases", () => {
    const state = addPublished(createInitialVfsState(), "article.md", "Body", "Article", "current-name", ["old-name", "original-name"]);
    const article = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!article.ok) throw new Error("Article missing.");
    renderReaders(state, article.value.id);

    expect(container.querySelector(".article-reader__permalink a")?.getAttribute("href")).toBe("#/blog/current-name");
    expect(container.textContent).not.toContain("old-name");
    expect(container.textContent).not.toContain("original-name");
  });

  it("keeps the Reader node stable while its authored tag links select the Tags singleton", () => {
    window.history.replaceState(null, "", "/");
    let state = addPublished(createInitialVfsState(), "article.md", "Body", "Article", "article");
    const article = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Article missing.");
    state = { ...state, nodesById: { ...state.nodesById, [article.value.id]: { ...article.value, publication: { ...article.value.publication!, tags: ["Qt", "A/B", "机器人"] } } } };
    renderReaders(state, article.value.id);

    const tags = [...container.querySelectorAll<HTMLAnchorElement>(".article-reader__tags a")];
    expect(tags.map((tag) => tag.textContent)).toEqual(["Qt", "A/B", "机器人"]);
    expect(tags.map((tag) => tag.getAttribute("href"))).toEqual(["#/blog/tag/Qt", "#/blog/tag/A%2FB", "#/blog/tag/%E6%9C%BA%E5%99%A8%E4%BA%BA"]);
    const pushState = vi.spyOn(window.history, "pushState");
    act(() => tags[0]?.click());
    expect(launchApplication).toHaveBeenCalledWith("blog-tags", { intent: { type: "open-blog-tags", selectedTag: "Qt" } });
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(article.value.id);
    act(() => tags[0]?.click());
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(launchApplication).toHaveBeenCalledTimes(2);

    act(() => tags[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })));
    expect(launchApplication).toHaveBeenCalledTimes(2);
  });

  it("derives live previous and next controls from catalog order and launches canonical targets without replacing the current Reader", () => {
    let state = addPublished(createInitialVfsState(), "a.md", "Body A", "Article A", "current-a", ["old-a"]);
    state = addPublished(state, "b.md", "Body B", "Article B", "current-b");
    state = addPublished(state, "c.md", "Body C", "Article C", "current-c");
    const a = resolveVfsPath(state, "/home/user/Documents/a.md");
    const b = resolveVfsPath(state, "/home/user/Documents/b.md");
    const c = resolveVfsPath(state, "/home/user/Documents/c.md");
    if (!a.ok || !b.ok || !c.ok) throw new Error("Navigation fixtures missing.");
    renderReaders(state, b.value.id);

    const previous = container.querySelector<HTMLAnchorElement>(".article-reader__navigation-action--previous");
    const next = container.querySelector<HTMLAnchorElement>(".article-reader__navigation-action--next");
    if (!previous || !next) throw new Error("Navigation controls missing.");
    expect(previous.getAttribute("href")).toBe("#/blog/current-a");
    expect(previous.textContent).toContain("Article A");
    expect(previous.getAttribute("aria-label")).toBe("Previous article: Article A");
    expect(next.getAttribute("href")).toBe("#/blog/current-c");
    expect(next.textContent).toContain("Article C");
    expect(container.innerHTML).not.toContain("#/blog/old-a");

    act(() => previous.click());
    expect(window.location.hash).toBe("#/blog/current-a");
    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(1);
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: a.value.id } });
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(b.value.id);

    launchNewApplicationInstance.mockClear();
    window.history.replaceState(null, "", "/");
    act(() => next.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })));
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("keeps v4 targets navigable without a fake permalink and recomputes boundaries after live Trash and Restore", () => {
    let state = addPublished(createInitialVfsState(), "a.md", "Body A", "Article A");
    state = addPublished(state, "b.md", "Body B", "Article B", "current-b");
    state = addPublished(state, "c.md", "Body C", "Article C", "current-c");
    const a = resolveVfsPath(state, "/home/user/Documents/a.md");
    const b = resolveVfsPath(state, "/home/user/Documents/b.md");
    const c = resolveVfsPath(state, "/home/user/Documents/c.md");
    if (!a.ok || !b.ok || !c.ok) throw new Error("Navigation fixtures missing.");
    renderReaders(state, b.value.id);

    const previous = container.querySelector<HTMLButtonElement>("button.article-reader__navigation-action--previous");
    if (!previous) throw new Error("V4 previous button missing.");
    expect(previous.getAttribute("href")).toBeNull();
    act(() => previous.click());
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: a.value.id } });

    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/a.md", { now })).state;
    act(() => setFixtureState(state));
    expect(container.querySelector(".article-reader__navigation-action--previous")?.getAttribute("aria-disabled")).toBe("true");
    expect(container.textContent).not.toContain("Previous: Article A");

    state = expectMutation(restoreVfsNodeFromTrash(state, a.value.id, { now })).state;
    act(() => setFixtureState(state));
    expect(container.querySelector<HTMLButtonElement>("button.article-reader__navigation-action--previous")?.textContent).toContain("Article A");

    state = setPublication(state, "/home/user/Documents/c.md", { status: "draft" });
    act(() => setFixtureState(state));
    expect(container.querySelector(".article-reader__navigation-action--next")?.getAttribute("aria-disabled")).toBe("true");

    state = setPublication(state, "/home/user/Documents/a.md", { status: "published", publishedAt: "2026-09-11T08:00:00.000Z" });
    state = setPublication(state, "/home/user/Documents/c.md", { status: "published", slug: "current-c", publishedAt: "2026-09-13T08:00:00.000Z" });
    act(() => setFixtureState(state));
    expect(container.querySelector<HTMLButtonElement>("button.article-reader__navigation-action--next")?.textContent).toContain("Article A");
    expect(container.querySelector<HTMLAnchorElement>(".article-reader__navigation-action--previous")?.getAttribute("href")).toBe("#/blog/current-c");

    state = setPublication(state, "/home/user/Documents/b.md", { status: "draft" });
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("This article is no longer available.");
    expect(container.querySelector(".article-reader__tags")).toBeNull();
    expect(container.querySelector(".article-reader__navigation")).toBeNull();
  });

  it("follows live body edits, rename, move, Trash, Restore, and publication eligibility without retaining stale body", () => {
    let state = addPublished(createInitialVfsState(), "article.md", "Old body", "Display title");
    const article = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!article.ok) throw new Error("Article missing.");
    renderReaders(state, article.value.id);
    expect(container.textContent).toContain("Old body");

    state = expectMutation(writeVfsTextFile(state, "/home/user/Documents/article.md", "New body", { now })).state;
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("New body");

    state = expectMutation(renameVfsNode(state, "/home/user/Documents/article.md", "renamed.md", { now })).state;
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Source: /home/user/Documents/renamed.md");

    state = expectMutation(moveVfsNode(state, "/home/user/Documents/renamed.md", "/home/user/Downloads", { now })).state;
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Source: /home/user/Downloads/renamed.md");

    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Downloads/renamed.md", { now })).state;
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("This article is no longer available.");
    expect(container.textContent).not.toContain("New body");

    state = expectMutation(restoreVfsNodeFromTrash(state, article.value.id, { now })).state;
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("New body");

    const restored = state.nodesById[article.value.id];
    if (!restored || restored.kind !== "file") throw new Error("Restored article missing.");
    state = { ...state, nodesById: { ...state.nodesById, [restored.id]: { ...restored, publication: { status: "draft" } } } };
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("This article is no longer available.");
    expect(container.textContent).not.toContain("New body");
  });

  it("opens an internal document link through a normal new Konqueror instance and keeps reader instances isolated", () => {
    let state = addPublished(createInitialVfsState(), "one.md", "[Open notes](Notes.txt) [Open web](https://example.com/path)", "One");
    state = addPublished(state, "two.md", "Body two", "Two");
    const one = resolveVfsPath(state, "/home/user/Documents/one.md");
    const two = resolveVfsPath(state, "/home/user/Documents/two.md");
    const notes = resolveVfsPath(state, "/home/user/Documents/Notes.txt");
    if (!one.ok || !two.ok || !notes.ok) throw new Error("Fixtures missing.");
    renderReaders(state, one.value.id, two.value.id);

    const link = container.querySelector<HTMLAnchorElement>("a[href='/home/user/Documents/Notes.txt']");
    if (!link) throw new Error("Document link missing.");
    act(() => link.click());
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("konqueror", { intent: { type: "open-file", nodeId: notes.value.id } });
    const externalLink = container.querySelector<HTMLAnchorElement>("a[href='https://example.com/path']");
    if (!externalLink) throw new Error("External link missing.");
    act(() => externalLink.click());
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("konqueror", { intent: { type: "open-external-web", canonicalUrl: "https://example.com/path" } });
    expect(container.textContent).toContain("One");
    expect(container.textContent).toContain("Two");

    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/one.md", { now })).state;
    act(() => setFixtureState(state));
    const readers = [...container.querySelectorAll<HTMLElement>(".article-reader")];
    expect(readers[0]?.textContent).toContain("This article is no longer available.");
    expect(readers[1]?.textContent).toContain("Body two");
    expect(getVfsPathForNode(state, two.value.id).ok).toBe(true);
  });
});
