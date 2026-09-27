// @vitest-environment jsdom
import { act, StrictMode, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createVfsTextFile, moveVfsNodeToTrash, restoreVfsNodeFromTrash } from "../../vfs/mutations";
import { resolveVfsPath } from "../../vfs/queries";
import type { VfsPublicationMetadata, VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import { VfsContext } from "../../vfs/VfsContext";
import { BlogTags } from "./BlogTags";

const now = "2026-09-14T00:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let setFixtureState: Dispatch<SetStateAction<VfsState>>;
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;

const expectState = <T,>(result: { readonly ok: true; readonly state: VfsState; readonly value: T } | { readonly ok: false }): VfsState => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed.");
  return result.state;
};

const addPublished = (state: VfsState, name: string, title: string, publishedAt: string, tags: readonly string[], slug?: string, aliases: readonly string[] = []): VfsState => {
  const created = expectState(createVfsTextFile(state, "/home/user/Documents", name, "text", { now, mimeType: "text/markdown" }));
  const resolved = resolveVfsPath(created, `/home/user/Documents/${name}`);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error("Published fixture missing.");
  const publication: VfsPublicationMetadata = { status: "published", publishedAt, tags, ...(slug === undefined ? {} : { slug }), ...(aliases.length === 0 ? {} : { aliases }) };
  return { ...created, nodesById: { ...created.nodesById, [resolved.value.id]: { ...resolved.value, displayName: title, publication } } };
};

const setPublication = (state: VfsState, nodeId: string, publication: VfsPublicationMetadata, displayName?: string): VfsState => {
  const node = state.nodesById[nodeId];
  if (!node || node.kind !== "file") throw new Error("Published fixture missing.");
  return { ...state, nodesById: { ...state.nodesById, [nodeId]: { ...node, publication, ...(displayName === undefined ? {} : { displayName }) } } };
};

function Fixture({ children, initialState }: { readonly children: ReactNode; readonly initialState: VfsState }) {
  const [state, setState] = useState(initialState);
  setFixtureState = setState;
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const renderTags = (initialState: VfsState) => {
  launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance }}>
          <Fixture initialState={initialState}><BlogTags /></Fixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

const getTagButton = (tag: string): HTMLAnchorElement => {
  const button = [...container.querySelectorAll<HTMLAnchorElement>(".blog-tags__tag-button")].find((candidate) => candidate.firstElementChild?.textContent === tag);
  if (!button) throw new Error(`Missing tag '${tag}'.`);
  return button;
};

const getArticle = (nodeId: string): HTMLElement => {
  const article = container.querySelector<HTMLElement>(`[data-blog-tag-node-id='${nodeId}']`);
  if (!article) throw new Error(`Missing tag article '${nodeId}'.`);
  return article;
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

describe("Blog Tags live catalog", () => {
  it("renders exact code-point tag rows and an explicit no-selection detail without an untagged group", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "a.md", "A", "2026-09-16T04:00:00.000Z", ["KDE 3"], "a");
    state = addPublished(state, "b.md", "B", "2026-09-16T03:00:00.000Z", ["KDE 3", "Qt"], "b");
    state = addPublished(state, "c.md", "C", "2026-09-16T02:00:00.000Z", ["qt", "Web", "机器人"], "c");
    state = addPublished(state, "untagged.md", "Untagged", "2026-09-16T01:00:00.000Z", [], "untagged");
    renderTags(state);

    expect([...container.querySelectorAll(".blog-tags__tag-button")].map((button) => button.firstElementChild?.textContent)).toEqual(["KDE 3", "Qt", "Web", "qt", "机器人"]);
    expect(container.textContent).toContain("Select a tag to view published articles.");
    expect(container.textContent).not.toContain("Untagged");
  });

  it("makes master rows canonical native tag links while ordinary clicks push once and modified clicks remain native", () => {
    const state = addPublished(createVfsTestStateWithoutRepositoryContent(), "special.md", "Special", "2026-09-16T04:00:00.000Z", ["KDE 3", "C++", "A/B", "100%", "机器人"], "special");
    renderTags(state);
    const kde = getTagButton("KDE 3");
    const plus = getTagButton("C++");
    const slash = getTagButton("A/B");
    const percent = getTagButton("100%");
    const unicode = getTagButton("机器人");
    expect(kde.getAttribute("href")).toBe("#/blog/tag/KDE%203");
    expect(plus.getAttribute("href")).toBe("#/blog/tag/C%2B%2B");
    expect(slash.getAttribute("href")).toBe("#/blog/tag/A%2FB");
    expect(percent.getAttribute("href")).toBe("#/blog/tag/100%25");
    expect(unicode.getAttribute("href")).toBe("#/blog/tag/%E6%9C%BA%E5%99%A8%E4%BA%BA");

    const pushState = vi.spyOn(window.history, "pushState");
    act(() => kde.click());
    expect(window.location.hash).toBe("#/blog/tag/KDE%203");
    expect(kde.getAttribute("aria-current")).toBe("page");
    expect(pushState).toHaveBeenCalledTimes(1);
    act(() => kde.click());
    expect(pushState).toHaveBeenCalledTimes(1);
    act(() => plus.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })));
    expect(window.location.hash).toBe("#/blog/tag/KDE%203");
    expect(kde.getAttribute("aria-current")).toBe("page");
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("selects a tag with catalog-ordered compact entries and keeps canonical, v4, and modified-click activation contracts", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "z.md", "Z title", "2026-09-12T08:00:00.000Z", ["Web"], "current-z", ["old-z"]);
    state = addPublished(state, "a.md", "A title", "2026-09-11T08:00:00.000Z", ["Web"]);
    const z = resolveVfsPath(state, "/home/user/Documents/z.md");
    const a = resolveVfsPath(state, "/home/user/Documents/a.md");
    if (!z.ok || !a.ok) throw new Error("Tag fixtures missing.");
    renderTags(state);

    act(() => getTagButton("Web").click());
    const text = container.textContent ?? "";
    expect(text.indexOf("Z title")).toBeLessThan(text.indexOf("A title"));
    expect(container.querySelector(".blog-tags__detail-heading")?.textContent).toContain("Tag: Web");
    expect(container.querySelector(".blog-tags__summary")).toBeNull();
    const permalink = getArticle(z.value.id).querySelector<HTMLAnchorElement>("a");
    if (!permalink) throw new Error("Canonical tag link missing.");
    expect(permalink.getAttribute("href")).toBe("#/blog/current-z");
    expect(container.innerHTML).not.toContain("old-z");
    act(() => permalink.click());
    expect(window.location.hash).toBe("#/blog/current-z");
    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(1);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: z.value.id } });

    launchNewApplicationInstance.mockClear();
    window.history.replaceState(null, "", "/");
    act(() => permalink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })));
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");

    const legacyButton = getArticle(a.value.id).querySelector<HTMLButtonElement>("button");
    if (!legacyButton) throw new Error("v4 tag button missing.");
    act(() => legacyButton.click());
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: a.value.id } });
  });

  it("keeps selected groups live for Trash, Restore, membership changes, exact case changes, reordering, titles, and canonical slugs", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "a.md", "A", "2026-09-16T04:00:00.000Z", ["KDE 3", "Web"], "a");
    state = addPublished(state, "b.md", "B", "2026-09-16T03:00:00.000Z", ["KDE 3", "Qt"], "b");
    const a = resolveVfsPath(state, "/home/user/Documents/a.md");
    const b = resolveVfsPath(state, "/home/user/Documents/b.md");
    if (!a.ok || !b.ok || a.value.kind !== "file" || b.value.kind !== "file") throw new Error("Tag fixtures missing.");
    renderTags(state);

    act(() => getTagButton("KDE 3").click());
    state = expectState(moveVfsNodeToTrash(state, "/home/user/Documents/a.md", { now }));
    act(() => setFixtureState(state));
    expect(container.querySelector(`[data-blog-tag-node-id='${a.value.id}']`)).toBeNull();
    expect(getArticle(b.value.id).textContent).toContain("B");

    state = expectState(restoreVfsNodeFromTrash(state, a.value.id, { now }));
    act(() => setFixtureState(state));
    expect(getArticle(a.value.id).textContent).toContain("A");

    state = setPublication(state, a.value.id, { status: "published", publishedAt: "2026-09-16T01:00:00.000Z", tags: ["Web"], slug: "updated-a" }, "Updated A");
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Tag: KDE 3");
    expect(container.querySelector(`[data-blog-tag-node-id='${a.value.id}']`)).toBeNull();
    expect(getArticle(b.value.id).textContent).toContain("B");
    expect(getTagButton("Web").textContent).toContain("1 article");

    state = setPublication(state, b.value.id, { status: "published", publishedAt: "2026-09-16T00:00:00.000Z", tags: ["qt"], slug: "updated-b" });
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("Select a tag to view published articles.");
    expect([...container.querySelectorAll(".blog-tags__tag-button")].map((button) => button.firstElementChild?.textContent)).toEqual(["Web", "qt"]);

    act(() => getTagButton("Web").click());
    expect(getArticle(a.value.id).textContent).toContain("Updated A");
    expect(getArticle(a.value.id).querySelector("a")?.getAttribute("href")).toBe("#/blog/updated-a");
  });

  it("clears selection when its final group disappears and leaves untagged published articles out of the index", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "only.md", "Only", "2026-09-12T08:00:00.000Z", ["Only tag"], "only");
    state = addPublished(state, "untagged.md", "Untitled", "2026-09-11T08:00:00.000Z", [], "untagged");
    const only = resolveVfsPath(state, "/home/user/Documents/only.md");
    if (!only.ok || only.value.kind !== "file") throw new Error("Tag fixture missing.");
    renderTags(state);

    act(() => getTagButton("Only tag").click());
    state = setPublication(state, only.value.id, { status: "published", publishedAt: "2026-09-12T08:00:00.000Z", tags: [], slug: "only" });
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("No published tags yet.");
    expect(container.textContent).not.toContain("Untitled");
  });

  it("follows live catalog reordering inside an already selected tag group", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "a.md", "A", "2026-09-12T08:00:00.000Z", ["Web"], "a");
    state = addPublished(state, "b.md", "B", "2026-09-11T08:00:00.000Z", ["Web"], "b");
    const a = resolveVfsPath(state, "/home/user/Documents/a.md");
    const b = resolveVfsPath(state, "/home/user/Documents/b.md");
    if (!a.ok || !b.ok || b.value.kind !== "file") throw new Error("Tag fixtures missing.");
    renderTags(state);

    act(() => getTagButton("Web").click());
    let entries = [...container.querySelectorAll<HTMLElement>("[data-blog-tag-node-id]")].map((article) => article.getAttribute("data-blog-tag-node-id"));
    expect(entries).toEqual([a.value.id, b.value.id]);

    state = setPublication(state, b.value.id, { status: "published", publishedAt: "2026-09-13T08:00:00.000Z", tags: ["Web"], slug: "b" });
    act(() => setFixtureState(state));
    entries = [...container.querySelectorAll<HTMLElement>("[data-blog-tag-node-id]")].map((article) => article.getAttribute("data-blog-tag-node-id"));
    expect(entries).toEqual([b.value.id, a.value.id]);
  });
});
