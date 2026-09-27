// @vitest-environment jsdom
import { act, StrictMode, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { copyVfsNode, createVfsTextFile, moveVfsNode, moveVfsNodeToTrash, renameVfsNode, restoreVfsNodeFromTrash } from "../../vfs/mutations";
import { getVfsPathForNode, resolveVfsPath } from "../../vfs/queries";
import type { VfsPublicationMetadata, VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import { VfsContext } from "../../vfs/VfsContext";
import { Blog } from "./Blog";

const now = "2026-09-14T00:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let setFixtureState: Dispatch<SetStateAction<VfsState>>;
let launchApplication: ReturnType<typeof vi.fn>;
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;

const expectMutation = (result: ReturnType<typeof createVfsTextFile>): { readonly state: VfsState } => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed.");
  return result;
};

const expectState = <T,>(result: { readonly ok: true; readonly state: VfsState; readonly value: T } | { readonly ok: false }): VfsState => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed.");
  return result.state;
};

const addPublished = (state: VfsState, name: string, title: string, publishedAt = "2026-09-12T08:00:00.000Z", slug?: string, aliases: readonly string[] = [], tags: readonly string[] = []): VfsState => {
  const created = expectMutation(createVfsTextFile(state, "/home/user/Documents", name, "text", { now, mimeType: "text/markdown" })).state;
  const resolved = resolveVfsPath(created, `/home/user/Documents/${name}`);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error("Published fixture missing.");
  const publication: VfsPublicationMetadata = { status: "published", publishedAt, ...(slug === undefined ? {} : { slug }), ...(aliases.length === 0 ? {} : { aliases }), ...(tags.length === 0 ? {} : { tags }) };
  return { ...created, nodesById: { ...created.nodesById, [resolved.value.id]: { ...resolved.value, displayName: title, publication } } };
};

const Fixture = ({ children, initialState }: { readonly children: ReactNode; readonly initialState: VfsState }) => {
  const [state, setState] = useState(initialState);
  setFixtureState = setState;
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
};

const renderBlog = (initialState: VfsState) => {
  launchApplication = vi.fn((): LaunchApplicationResult => "opened");
  launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance }}>
          <Fixture initialState={initialState}><Blog /></Fixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

const clickTitle = (nodeId: string) => {
  const title = container.querySelector<HTMLElement>(`[data-blog-node-id='${nodeId}'] .blog-article__title`);
  if (!title) throw new Error(`Missing Blog title for ${nodeId}.`);
  act(() => title.click());
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

describe("Blog opening and live catalog", () => {
  it("keeps Archive, Tags, and Search available as normal singleton application launch controls", () => {
    renderBlog(createVfsTestStateWithoutRepositoryContent());
    const archive = container.querySelector<HTMLButtonElement>(".blog-app__archive-button");
    const tags = container.querySelector<HTMLButtonElement>(".blog-app__tags-button");
    const search = container.querySelector<HTMLButtonElement>(".blog-app__search-button");
    if (!archive) throw new Error("Archive control missing.");
    if (!tags) throw new Error("Tags control missing.");
    if (!search) throw new Error("Search control missing.");

    act(() => archive.click());
    act(() => tags.click());
    act(() => search.click());
    expect(launchApplication).toHaveBeenCalledWith("blog-archive");
    expect(launchApplication).toHaveBeenCalledWith("blog-tags");
    expect(launchApplication).toHaveBeenCalledWith("blog-search");
    expect(archive.getAttribute("href")).toBeNull();
    expect(tags.getAttribute("href")).toBeNull();
    expect(search.getAttribute("href")).toBeNull();
  });

  it("uses a canonical native permalink for v5 articles while keeping v4 articles on the nodeId-only fallback", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "slugged.md", "Slugged", undefined, "slugged-article");
    state = addPublished(state, "legacy.md", "Legacy");
    const slugged = resolveVfsPath(state, "/home/user/Documents/slugged.md");
    if (!slugged.ok) throw new Error("Slugged article missing.");
    renderBlog(state);

    const permalink = container.querySelector<HTMLAnchorElement>(`[data-blog-node-id='${slugged.value.id}'] .blog-article__title`);
    expect(permalink?.getAttribute("href")).toBe("#/blog/slugged-article");
    expect(container.querySelector(`[data-blog-node-id] button.blog-article__title`)?.textContent).toBe("Legacy");

    act(() => permalink?.click());
    expect(window.location.hash).toBe("#/blog/slugged-article");
    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(1);
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: slugged.value.id } });
  });

  it("keeps v6 historical aliases out of Blog links", () => {
    const state = addPublished(createVfsTestStateWithoutRepositoryContent(), "slugged.md", "Slugged", undefined, "current-name", ["old-name", "original-name"]);
    const article = resolveVfsPath(state, "/home/user/Documents/slugged.md");
    if (!article.ok) throw new Error("Slugged article missing.");
    renderBlog(state);

    const permalink = container.querySelector<HTMLAnchorElement>(`[data-blog-node-id='${article.value.id}'] .blog-article__title`);
    expect(permalink?.getAttribute("href")).toBe("#/blog/current-name");
    expect(container.innerHTML).not.toContain("#/blog/old-name");
    expect(container.innerHTML).not.toContain("#/blog/original-name");
  });

  it("keeps modified permalink activation native instead of launching a Reader in the current page", () => {
    const state = addPublished(createVfsTestStateWithoutRepositoryContent(), "slugged.md", "Slugged", undefined, "slugged-article");
    const slugged = resolveVfsPath(state, "/home/user/Documents/slugged.md");
    if (!slugged.ok || slugged.value.kind !== "file") throw new Error("Slugged article missing.");
    renderBlog(state);
    const permalink = container.querySelector<HTMLAnchorElement>(`[data-blog-node-id='${slugged.value.id}'] .blog-article__title`);
    if (!permalink) throw new Error("Permalink missing.");

    act(() => permalink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })));

    expect(launchNewApplicationInstance).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("renders authored tags as canonical native links and routes ordinary activation to the Tags singleton", () => {
    const state = addPublished(createVfsTestStateWithoutRepositoryContent(), "tagged.md", "Tagged", undefined, "tagged", [], ["KDE 3", "C++", "A/B", "100%", "%2F", "机器人"]);
    renderBlog(state);
    const tags = [...container.querySelectorAll<HTMLAnchorElement>(".blog-article__tags a")];
    expect(tags.map((tag) => tag.textContent)).toEqual(["KDE 3", "C++", "A/B", "100%", "%2F", "机器人"]);
    expect(tags.map((tag) => tag.getAttribute("href"))).toEqual(["#/blog/tag/KDE%203", "#/blog/tag/C%2B%2B", "#/blog/tag/A%2FB", "#/blog/tag/100%25", "#/blog/tag/%252F", "#/blog/tag/%E6%9C%BA%E5%99%A8%E4%BA%BA"]);

    const pushState = vi.spyOn(window.history, "pushState");
    act(() => tags[1]?.click());
    expect(launchApplication).toHaveBeenLastCalledWith("blog-tags", { intent: { type: "open-blog-tags", selectedTag: "C++" } });
    expect(pushState).toHaveBeenCalledTimes(1);
    act(() => tags[1]?.click());
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(launchApplication).toHaveBeenCalledTimes(2);

    act(() => tags[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })));
    expect(launchApplication).toHaveBeenCalledTimes(2);
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();
  });

  it("opens the stable file node in an Article Reader, never through the display title", () => {
    const state = addPublished(createVfsTestStateWithoutRepositoryContent(), "article.md", "My Article");
    const article = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Article missing.");
    renderBlog(state);

    clickTitle(article.value.id);
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: article.value.id } });
    expect(JSON.stringify(launchNewApplicationInstance.mock.calls)).not.toContain("My Article");
  });

  it("keeps duplicate titles independently operable by node id", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "one.md", "Project");
    state = addPublished(state, "two.md", "Project");
    const first = resolveVfsPath(state, "/home/user/Documents/one.md");
    const second = resolveVfsPath(state, "/home/user/Documents/two.md");
    if (!first.ok || !second.ok) throw new Error("Duplicate fixture missing.");
    renderBlog(state);

    clickTitle(first.value.id);
    clickTitle(second.value.id);
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(1, "article-reader", { intent: { type: "open-article-reader", nodeId: first.value.id } });
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(2, "article-reader", { intent: { type: "open-article-reader", nodeId: second.value.id } });
  });

  it("follows live rename, move, Trash, Restore, and copy publication behavior", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "article.md", "Article");
    const original = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!original.ok || original.value.kind !== "file") throw new Error("Article missing.");
    renderBlog(state);

    state = expectState(renameVfsNode(state, "/home/user/Documents/article.md", "renamed.md", { now }));
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Article");

    state = expectState(moveVfsNode(state, "/home/user/Documents/renamed.md", "/home/user/Downloads", { now }));
    act(() => setFixtureState(state));
    expect(getVfsPathForNode(state, original.value.id)).toEqual({ ok: true, value: "/home/user/Downloads/renamed.md" });
    clickTitle(original.value.id);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: original.value.id } });

    const copied = expectState(copyVfsNode(state, "/home/user/Downloads/renamed.md", "/home/user/Documents", { now }));
    state = copied;
    act(() => setFixtureState(state));
    expect(container.querySelectorAll("[data-blog-node-id]")).toHaveLength(1);

    state = expectState(moveVfsNodeToTrash(state, "/home/user/Downloads/renamed.md", { now }));
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("No published articles yet.");

    state = expectState(restoreVfsNodeFromTrash(state, original.value.id, { now }));
    act(() => setFixtureState(state));
    expect(container.querySelectorAll("[data-blog-node-id]")).toHaveLength(1);
  });
});
