// @vitest-environment jsdom
import { act, StrictMode, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationHost } from "../application-runtime/ApplicationHost";
import { ApplicationRuntimeProvider } from "../application-runtime/ApplicationRuntimeProvider";
import type { LaunchApplicationOptions, LaunchApplicationResult } from "../application-runtime/types";
import { ApplicationLauncherContext, useApplicationLauncher } from "../application-runtime/useApplicationLauncher";
import { Blog } from "../apps/blog/Blog";
import { createInitialVfsState } from "../vfs/initialState";
import { createVfsTextFile, moveVfsNodeToTrash, restoreVfsNodeFromTrash } from "../vfs/mutations";
import { resolveVfsPath } from "../vfs/queries";
import type { VfsState } from "../vfs/types";
import { createVfsOperations } from "../vfs/vfsOperations";
import { VfsContext } from "../vfs/VfsContext";
import { useWindowManager } from "../window-manager/useWindowManager";
import { WindowManagerProvider } from "../window-manager/WindowManagerProvider";
import { PublishedArticleRouteController } from "./PublishedArticleRouteController";

const now = "2026-09-15T08:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;
let setState: Dispatch<SetStateAction<VfsState>>;
let runtimeLaunchCalls: readonly [string, LaunchApplicationOptions | undefined][] = [];

const addPublished = (state: VfsState, slug: string, aliases: readonly string[] = []): VfsState => {
  const created = createVfsTextFile(state, "/home/user/Documents", `${slug}.md`, "body", { now, mimeType: "text/markdown" });
  if (!created.ok) throw new Error("Fixture creation failed.");
  const resolved = resolveVfsPath(created.state, `/home/user/Documents/${slug}.md`);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error("Fixture missing.");
  return { ...created.state, nodesById: { ...created.state.nodesById, [resolved.value.id]: {
    ...resolved.value,
    publication: { status: "published", slug, ...(aliases.length === 0 ? {} : { aliases }), publishedAt: "2026-09-14T08:00:00.000Z" },
  } } };
};

function Fixture({ initialState, children }: { readonly initialState: VfsState; readonly children: ReactNode }) {
  const [state, updateState] = useState(initialState);
  setState = updateState;
  const operations = useMemo(() => createVfsOperations(() => state, updateState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const renderController = (state: VfsState) => {
  launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(<StrictMode><ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance }}><Fixture initialState={state}><PublishedArticleRouteController /></Fixture></ApplicationLauncherContext.Provider></StrictMode>);
  });
};

function ArticleReaderWindows() {
  const { windows } = useWindowManager();
  const articleReaders = windows.filter((desktopWindow) => desktopWindow.appId === "article-reader");

  return <section data-article-reader-window-count={articleReaders.length}>
    {articleReaders.map((desktopWindow) => <ApplicationHost key={desktopWindow.id} desktopWindow={desktopWindow} />)}
  </section>;
}

function RuntimeLaunchRecorder({ children }: { readonly children: ReactNode }) {
  const launcher = useApplicationLauncher();
  const value = useMemo(() => ({
    ...launcher,
    launchNewApplicationInstance: (appId: string, options?: LaunchApplicationOptions) => {
      runtimeLaunchCalls = [...runtimeLaunchCalls, [appId, options]];
      return launcher.launchNewApplicationInstance(appId, options);
    },
  }), [launcher]);

  return <ApplicationLauncherContext.Provider value={value}>{children}</ApplicationLauncherContext.Provider>;
}

const renderRouteRuntime = async (state: VfsState, content: ReactNode = <PublishedArticleRouteController />) => {
  await act(async () => {
    reactRoot.render(
      <Fixture initialState={state}>
          <WindowManagerProvider initialWindows={[]}>
            <ApplicationRuntimeProvider>
              <RuntimeLaunchRecorder>
                {content}
                <ArticleReaderWindows />
              </RuntimeLaunchRecorder>
            </ApplicationRuntimeProvider>
        </WindowManagerProvider>
      </Fixture>,
    );
  });
  await act(async () => undefined);
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  runtimeLaunchCalls = [];
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("PublishedArticleRouteController", () => {
  it("delivers the canonical nodeId intent to one live Article Reader on an initial deep link", async () => {
    const state = addPublished(createInitialVfsState(), "route-controller-live-test");
    const article = resolveVfsPath(state, "/home/user/Documents/route-controller-live-test.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Article missing.");
    window.history.replaceState(null, "", "#/blog/route-controller-live-test");

    await renderRouteRuntime(state);

    expect(runtimeLaunchCalls).toHaveLength(1);
    expect(runtimeLaunchCalls[0]).toEqual(["article-reader", { intent: { type: "open-article-reader", nodeId: article.value.id } }]);
    expect(container.querySelector("[data-article-reader-window-count]")?.getAttribute("data-article-reader-window-count")).toBe("1");
    expect(container.querySelectorAll(".article-reader")).toHaveLength(1);
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(article.value.id);
    expect(container.textContent).toContain("body");
    expect(container.textContent).not.toContain("This article is no longer available.");
  });

  it("canonicalizes an initial alias with replaceState and opens exactly one live Reader by canonical nodeId", async () => {
    const state = addPublished(createInitialVfsState(), "current-route", ["old-route", "original-route"]);
    const article = resolveVfsPath(state, "/home/user/Documents/current-route.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Article missing.");
    window.history.replaceState(null, "", "#/blog/old-route");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");

    await renderRouteRuntime(state);

    expect(window.location.hash).toBe("#/blog/current-route");
    expect(replaceState).toHaveBeenCalledWith(null, "", "#/blog/current-route");
    expect(pushState).not.toHaveBeenCalled();
    expect(runtimeLaunchCalls).toEqual([["article-reader", { intent: { type: "open-article-reader", nodeId: article.value.id } }]]);
    expect(container.querySelectorAll(".article-reader")).toHaveLength(1);
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(article.value.id);
  });

  it("keeps draft and Trash aliases private, then resolves the restored published alias", () => {
    const state = addPublished(createInitialVfsState(), "current-route", ["old-route"]);
    const article = resolveVfsPath(state, "/home/user/Documents/current-route.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Article missing.");
    const draftState: VfsState = { ...state, nodesById: { ...state.nodesById, [article.value.id]: {
      ...article.value,
      publication: { ...article.value.publication!, status: "draft" },
    } } };
    window.history.replaceState(null, "", "#/blog/old-route");
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderController(draftState);
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("#/blog/old-route");
    expect(replaceState).not.toHaveBeenCalled();

    const trashed = moveVfsNodeToTrash(state, "/home/user/Documents/current-route.md", { now });
    if (!trashed.ok) throw new Error("Trash fixture failed.");
    act(() => setState(trashed.state));
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();

    const restored = restoreVfsNodeFromTrash(trashed.state, article.value.id, { now });
    if (!restored.ok) throw new Error("Restore fixture failed.");
    act(() => setState(restored.state));
    expect(window.location.hash).toBe("#/blog/current-route");
    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(1);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: article.value.id } });
  });

  it("keeps a normal slugged Blog click to one canonical Reader launch", async () => {
    const state = addPublished(createInitialVfsState(), "blog-click-live-test");
    const article = resolveVfsPath(state, "/home/user/Documents/blog-click-live-test.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Article missing.");

    await renderRouteRuntime(state, <><PublishedArticleRouteController /><Blog /></>);
    const title = container.querySelector<HTMLAnchorElement>(`[data-blog-node-id='${article.value.id}'] .blog-article__title`);
    if (!title) throw new Error("Blog permalink missing.");

    act(() => title.click());

    expect(window.location.hash).toBe("#/blog/blog-click-live-test");
    expect(runtimeLaunchCalls).toEqual([["article-reader", { intent: { type: "open-article-reader", nodeId: article.value.id } }]]);
    expect(container.querySelectorAll(".article-reader")).toHaveLength(1);
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(article.value.id);
  });

  it("opens one additional live Reader from a footer canonical neighbor click without replacing the current Reader", async () => {
    let state = addPublished(createInitialVfsState(), "footer-a");
    state = addPublished(state, "footer-b");
    state = addPublished(state, "footer-c");
    const a = resolveVfsPath(state, "/home/user/Documents/footer-a.md");
    const b = resolveVfsPath(state, "/home/user/Documents/footer-b.md");
    if (!a.ok || !b.ok || a.value.kind !== "file" || b.value.kind !== "file") throw new Error("Footer navigation fixtures missing.");
    window.history.replaceState(null, "", "#/blog/footer-b");

    await renderRouteRuntime(state);
    const previous = container.querySelector<HTMLAnchorElement>(".article-reader__navigation-action--previous");
    if (!previous) throw new Error("Reader footer previous link missing.");
    act(() => previous.click());

    expect(window.location.hash).toBe("#/blog/footer-a");
    expect(runtimeLaunchCalls).toEqual([
      ["article-reader", { intent: { type: "open-article-reader", nodeId: b.value.id } }],
      ["article-reader", { intent: { type: "open-article-reader", nodeId: a.value.id } }],
    ]);
    expect(container.querySelector("[data-article-reader-window-count]")?.getAttribute("data-article-reader-window-count")).toBe("2");
    expect(container.querySelectorAll(`[data-article-node-id='${b.value.id}']`)).toHaveLength(1);
    expect(container.querySelectorAll(`[data-article-node-id='${a.value.id}']`)).toHaveLength(1);
    expect(container.textContent).not.toContain("This article is no longer available.");
  });

  it("does not create an unavailable Reader for an unknown initial route", async () => {
    window.history.replaceState(null, "", "#/blog/no-such-article");

    await renderRouteRuntime(createInitialVfsState());

    expect(runtimeLaunchCalls).toEqual([]);
    expect(container.querySelectorAll(".article-reader")).toHaveLength(0);
    expect(container.textContent).not.toContain("This article is no longer available.");
  });

  it("keeps the one-segment search namespace available to a published article slug", () => {
    const state = addPublished(createInitialVfsState(), "search");
    const article = resolveVfsPath(state, "/home/user/Documents/search.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Search-slug article missing.");
    window.history.replaceState(null, "", "#/blog/search");
    renderController(state);

    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: article.value.id } });
  });

  it("opens a current published node once on initial route and deduplicates hashchange/popstate delivery", () => {
    const state = addPublished(createInitialVfsState(), "deep-link");
    const article = resolveVfsPath(state, "/home/user/Documents/deep-link.md");
    if (!article.ok) throw new Error("Article missing.");
    window.history.replaceState(null, "", "#/blog/deep-link");
    renderController(state);

    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(1);
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: article.value.id } });
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(1);
  });

  it("ignores unrelated, unknown, and no-longer-published routes", () => {
    let state = addPublished(createInitialVfsState(), "available");
    window.history.replaceState(null, "", "#other-fragment");
    renderController(state);
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();

    act(() => {
      window.history.replaceState(null, "", "#/blog/missing");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();

    const trashed = moveVfsNodeToTrash(state, "/home/user/Documents/available.md", { now });
    if (!trashed.ok) throw new Error("Trash fixture failed.");
    state = trashed.state;
    act(() => setState(state));
    window.history.replaceState(null, "", "#/blog/available");
    act(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();
  });

  it("re-resolves the same hash after a published node returns from Trash", () => {
    let state = addPublished(createInitialVfsState(), "restorable");
    const article = resolveVfsPath(state, "/home/user/Documents/restorable.md");
    if (!article.ok) throw new Error("Article missing.");
    window.history.replaceState(null, "", "#/blog/restorable");
    renderController(state);
    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(1);

    const trashed = moveVfsNodeToTrash(state, "/home/user/Documents/restorable.md", { now });
    if (!trashed.ok) throw new Error("Trash fixture failed.");
    state = trashed.state;
    act(() => setState(state));
    const restored = restoreVfsNodeFromTrash(state, article.value.id, { now });
    if (!restored.ok) throw new Error("Restore fixture failed.");
    act(() => setState(restored.state));

    expect(launchNewApplicationInstance).toHaveBeenCalledTimes(2);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("article-reader", { intent: { type: "open-article-reader", nodeId: article.value.id } });
  });
});
