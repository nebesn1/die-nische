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
import { BlogArchive } from "./BlogArchive";

const now = "2026-09-14T00:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let setFixtureState: Dispatch<SetStateAction<VfsState>>;
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;

const expectState = <T,>(result: { readonly ok: true; readonly state: VfsState; readonly value: T } | { readonly ok: false }): VfsState => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed.");
  return result.state;
};

const addPublished = (
  state: VfsState,
  name: string,
  title: string,
  publishedAt: string,
  slug?: string,
  aliases: readonly string[] = [],
): VfsState => {
  const created = expectState(createVfsTextFile(state, "/home/user/Documents", name, "text", { now, mimeType: "text/markdown" }));
  const resolved = resolveVfsPath(created, `/home/user/Documents/${name}`);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error("Published fixture missing.");
  const publication: VfsPublicationMetadata = { status: "published", publishedAt, ...(slug === undefined ? {} : { slug }), ...(aliases.length === 0 ? {} : { aliases }) };

  return { ...created, nodesById: { ...created.nodesById, [resolved.value.id]: { ...resolved.value, displayName: title, publication } } };
};

const setPublication = (state: VfsState, nodeId: string, publication: VfsPublicationMetadata, displayName?: string): VfsState => {
  const node = state.nodesById[nodeId];
  if (!node || node.kind !== "file") throw new Error("Published fixture missing.");
  return { ...state, nodesById: { ...state.nodesById, [nodeId]: { ...node, publication, ...(displayName === undefined ? {} : { displayName }) } } };
};

const Fixture = ({ children, initialState }: { readonly children: ReactNode; readonly initialState: VfsState }) => {
  const [state, setState] = useState(initialState);
  setFixtureState = setState;
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
};

const renderArchive = (initialState: VfsState) => {
  launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance }}>
          <Fixture initialState={initialState}><BlogArchive /></Fixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

const getArticle = (nodeId: string): HTMLElement => {
  const article = container.querySelector<HTMLElement>(`[data-blog-archive-node-id='${nodeId}']`);
  if (!article) throw new Error(`Missing archive article '${nodeId}'.`);
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

describe("Blog Archive live catalog", () => {
  it("renders UTC year/month groups in catalog order with compact rows and canonical links only", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "sep-z.md", "Z title", "2026-09-20T12:00:00.000Z", "current-z", ["old-z"]);
    state = addPublished(state, "sep-a.md", "A title", "2026-09-05T12:00:00.000Z", "current-a");
    state = addPublished(state, "august.md", "August", "2026-08-31T23:30:00.000Z", "august");
    state = addPublished(state, "legacy.md", "Legacy", "2025-12-15T12:00:00.000Z");
    const z = resolveVfsPath(state, "/home/user/Documents/sep-z.md");
    const legacy = resolveVfsPath(state, "/home/user/Documents/legacy.md");
    if (!z.ok || !legacy.ok) throw new Error("Archive fixtures missing.");
    renderArchive(state);

    const text = container.textContent ?? "";
    expect(text.indexOf("2026")).toBeLessThan(text.indexOf("2025"));
    expect(text.indexOf("September")).toBeLessThan(text.indexOf("August"));
    expect(text.indexOf("Z title")).toBeLessThan(text.indexOf("A title"));
    expect(getArticle(z.value.id).querySelector("a")?.getAttribute("href")).toBe("#/blog/current-z");
    expect(container.innerHTML).not.toContain("old-z");
    expect(getArticle(legacy.value.id).querySelector("button")?.getAttribute("href")).toBeNull();
    expect(container.querySelector(".blog-archive__summary")).toBeNull();
    expect(container.querySelector(".blog-archive__tags")).toBeNull();
  });

  it("uses canonical normal activation, native modified clicks, and node-id v4 fallback", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "slugged.md", "Slugged", "2026-09-12T08:00:00.000Z", "current-slug", ["old-slug"]);
    state = addPublished(state, "legacy.md", "Legacy", "2026-09-11T08:00:00.000Z");
    const slugged = resolveVfsPath(state, "/home/user/Documents/slugged.md");
    const legacy = resolveVfsPath(state, "/home/user/Documents/legacy.md");
    if (!slugged.ok || !legacy.ok) throw new Error("Archive fixtures missing.");
    renderArchive(state);

    const permalink = getArticle(slugged.value.id).querySelector<HTMLAnchorElement>("a");
    if (!permalink) throw new Error("Archive permalink missing.");
    act(() => permalink.click());
    expect(window.location.hash).toBe("#/blog/current-slug");
    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(1);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: slugged.value.id } });

    launchNewApplicationInstance.mockClear();
    window.history.replaceState(null, "", "/");
    act(() => permalink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })));
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");

    const legacyButton = getArticle(legacy.value.id).querySelector<HTMLButtonElement>("button");
    if (!legacyButton) throw new Error("Legacy archive control missing.");
    act(() => legacyButton.click());
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: legacy.value.id } });
  });

  it("updates rows and UTC groups live through Trash, Restore, draft, republish, title, month, and year transitions", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "september.md", "September", "2026-09-12T08:00:00.000Z", "september");
    state = addPublished(state, "august.md", "August", "2026-08-15T12:00:00.000Z", "august");
    const september = resolveVfsPath(state, "/home/user/Documents/september.md");
    const august = resolveVfsPath(state, "/home/user/Documents/august.md");
    if (!september.ok || !august.ok || september.value.kind !== "file" || august.value.kind !== "file") throw new Error("Archive fixtures missing.");
    renderArchive(state);

    state = expectState(moveVfsNodeToTrash(state, "/home/user/Documents/august.md", { now }));
    act(() => setFixtureState(state));
    expect(container.querySelector(`[data-blog-archive-node-id='${august.value.id}']`)).toBeNull();
    expect(container.textContent).not.toContain("August");

    state = expectState(restoreVfsNodeFromTrash(state, august.value.id, { now }));
    act(() => setFixtureState(state));
    expect(getArticle(august.value.id).textContent).toContain("August");

    state = setPublication(state, september.value.id, { status: "draft" });
    act(() => setFixtureState(state));
    expect(container.querySelector(`[data-blog-archive-node-id='${september.value.id}']`)).toBeNull();
    expect(container.textContent).not.toContain("September");

    state = setPublication(state, september.value.id, { status: "published", publishedAt: "2026-07-05T12:00:00.000Z", slug: "updated-september" }, "Updated title");
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("July");
    expect(getArticle(september.value.id).textContent).toContain("Updated title");
    expect(getArticle(september.value.id).querySelector("a")?.getAttribute("href")).toBe("#/blog/updated-september");

    state = setPublication(state, september.value.id, { status: "published", publishedAt: "2025-12-05T12:00:00.000Z", slug: "updated-september" });
    act(() => setFixtureState(state));
    expect(container.textContent).toContain("2025");
    expect(container.textContent).not.toContain("July");
  });

  it("keeps duplicate titles independently actionable by stable node id", () => {
    let state = addPublished(createVfsTestStateWithoutRepositoryContent(), "one.md", "Project", "2026-09-12T08:00:00.000Z", "one");
    state = addPublished(state, "two.md", "Project", "2026-09-11T08:00:00.000Z", "two");
    const one = resolveVfsPath(state, "/home/user/Documents/one.md");
    const two = resolveVfsPath(state, "/home/user/Documents/two.md");
    if (!one.ok || !two.ok) throw new Error("Archive fixtures missing.");
    renderArchive(state);

    act(() => getArticle(one.value.id).querySelector<HTMLElement>(".blog-archive__article-title")?.click());
    act(() => getArticle(two.value.id).querySelector<HTMLElement>(".blog-archive__article-title")?.click());
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(1, "article-reader", { intent: { type: "open-article-reader", nodeId: one.value.id } });
    expect(launchNewApplicationInstance).toHaveBeenNthCalledWith(2, "article-reader", { intent: { type: "open-article-reader", nodeId: two.value.id } });
  });
});
