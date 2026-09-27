// @vitest-environment jsdom
import { act, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApplicationHost } from "../../application-runtime/ApplicationHost";
import { ApplicationRuntimeProvider } from "../../application-runtime/ApplicationRuntimeProvider";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { createVfsTextFile } from "../../vfs/mutations";
import { resolveVfsPath } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import { VfsContext } from "../../vfs/VfsContext";
import { useWindowManager } from "../../window-manager/useWindowManager";
import { WindowManagerProvider } from "../../window-manager/WindowManagerProvider";
import { PublishedTagRouteController } from "../../desktop/PublishedTagRouteController";
import { PublishedArticleRouteController } from "../../desktop/PublishedArticleRouteController";

const now = "2026-09-14T00:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let setFixtureState: Dispatch<SetStateAction<VfsState>>;

const addPublished = (state: VfsState): { readonly state: VfsState; readonly nodeId: string } => {
  const created = createVfsTextFile(state, "/home/user/Documents", "tags-runtime.md", "body", { now, mimeType: "text/markdown" });
  if (!created.ok) throw new Error("Expected tag fixture creation to succeed.");
  const article = resolveVfsPath(created.state, "/home/user/Documents/tags-runtime.md");
  if (!article.ok || article.value.kind !== "file") throw new Error("Tag fixture missing.");
  return {
    nodeId: article.value.id,
    state: {
      ...created.state,
      nodesById: {
        ...created.state.nodesById,
        [article.value.id]: {
          ...article.value,
          displayName: "Runtime Tag Article",
          publication: { status: "published", publishedAt: "2026-09-12T08:00:00.000Z", slug: "runtime-tags", tags: ["Web", "Qt"] },
        },
      },
    },
  };
};

const addRoutedPublished = (state: VfsState, name: string, tag: string): VfsState => {
  const created = createVfsTextFile(state, "/home/user/Documents", name, "body", { now, mimeType: "text/markdown" });
  if (!created.ok) throw new Error("Expected route fixture creation to succeed.");
  const article = resolveVfsPath(created.state, `/home/user/Documents/${name}`);
  if (!article.ok || article.value.kind !== "file") throw new Error("Route fixture missing.");
  return { ...created.state, nodesById: { ...created.state.nodesById, [article.value.id]: {
    ...article.value,
    displayName: tag,
    publication: { status: "published", publishedAt: "2026-09-12T08:00:00.000Z", slug: name.slice(0, -3), tags: [tag] },
  } } };
};

function Fixture({ children, initialState }: { readonly children: ReactNode; readonly initialState: VfsState }) {
  const [state, setState] = useState(initialState);
  setFixtureState = setState;
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

function RuntimeControls() {
  const { launchApplication } = useApplicationLauncher();
  return <button type="button" onClick={() => launchApplication("blog")}>Open Blog</button>;
}

function RuntimeWindows() {
  const { windows } = useWindowManager();
  const tagCount = windows.filter((desktopWindow) => desktopWindow.appId === "blog-tags").length;
  const readerCount = windows.filter((desktopWindow) => desktopWindow.appId === "article-reader").length;
  return <section data-blog-tags-window-count={tagCount} data-article-reader-window-count={readerCount}>{windows.map((desktopWindow) => <ApplicationHost key={desktopWindow.id} desktopWindow={desktopWindow} />)}</section>;
}

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
});

describe("Blog Tags runtime", () => {
  it("consumes initial and later exact tag route intents in one live singleton", () => {
    let state = addRoutedPublished(createVfsTestStateWithoutRepositoryContent(), "kde.md", "KDE 3");
    state = addRoutedPublished(state, "web.md", "Web");
    window.history.replaceState(null, "", "#/blog/tag/KDE%203");
    const kde = resolveVfsPath(state, "/home/user/Documents/kde.md");
    if (!kde.ok || kde.value.kind !== "file") throw new Error("KDE route fixture missing.");
    act(() => {
      reactRoot.render(
        <Fixture initialState={state}>
          <WindowManagerProvider initialWindows={[]}>
            <ApplicationRuntimeProvider><PublishedArticleRouteController /><PublishedTagRouteController /><RuntimeWindows /></ApplicationRuntimeProvider>
          </WindowManagerProvider>
        </Fixture>,
      );
    });

    expect(container.querySelector("[data-blog-tags-window-count]")?.getAttribute("data-blog-tags-window-count")).toBe("1");
    expect(container.querySelector("[data-article-reader-window-count]")?.getAttribute("data-article-reader-window-count")).toBe("0");
    expect(container.querySelector(".blog-tags__detail-heading")?.textContent).toContain("Tag: KDE 3");
    act(() => {
      window.history.replaceState(null, "", "#/blog/tag/Web");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(container.querySelector("[data-blog-tags-window-count]")?.getAttribute("data-blog-tags-window-count")).toBe("1");
    expect(container.querySelector(".blog-tags__detail-heading")?.textContent).toContain("Tag: Web");

    act(() => {
      window.history.replaceState(null, "", "#/blog/tag/KDE%203");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const withoutKde: VfsState = { ...state, nodesById: { ...state.nodesById, [kde.value.id]: {
      ...kde.value,
      publication: { ...kde.value.publication!, tags: [] },
    } } };
    act(() => setFixtureState(withoutKde));
    expect(window.location.hash).toBe("#/blog/tag/KDE%203");
    expect(container.querySelector(".blog-tags__selection-prompt")?.textContent).toContain("Select a tag");
    expect(container.querySelector("[data-blog-tags-window-count]")?.getAttribute("data-blog-tags-window-count")).toBe("1");
    act(() => setFixtureState(state));
    expect(container.querySelector(".blog-tags__detail-heading")?.textContent).toContain("Tag: KDE 3");
  });

  it("routes Blog and Reader tag links through one live Tags singleton without replacing the Reader", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent());
    act(() => {
      reactRoot.render(
        <Fixture initialState={fixture.state}>
          <WindowManagerProvider initialWindows={[]}>
            <ApplicationRuntimeProvider><RuntimeControls /><RuntimeWindows /></ApplicationRuntimeProvider>
          </WindowManagerProvider>
        </Fixture>,
      );
    });

    const openBlog = container.querySelector<HTMLButtonElement>("button");
    if (!openBlog) throw new Error("Blog launcher missing.");
    act(() => openBlog.click());
    const blogWebTag = [...container.querySelectorAll<HTMLAnchorElement>(".blog-article__tags a")].find((tagLink) => tagLink.textContent === "Web");
    if (!blogWebTag) throw new Error("Blog Web tag missing.");
    act(() => blogWebTag.click());
    expect(container.querySelector("[data-blog-tags-window-count]")?.getAttribute("data-blog-tags-window-count")).toBe("1");
    expect(window.location.hash).toBe("#/blog/tag/Web");
    expect(container.querySelector(".blog-tags__detail-heading")?.textContent).toContain("Tag: Web");
    expect(container.querySelector("[data-article-reader-window-count]")?.getAttribute("data-article-reader-window-count")).toBe("0");
    const link = container.querySelector<HTMLAnchorElement>(`[data-blog-tag-node-id='${fixture.nodeId}'] .blog-tags__article-title`);
    if (!link) throw new Error("Tag article link missing.");
    act(() => link.click());

    expect(window.location.hash).toBe("#/blog/runtime-tags");
    expect(container.querySelector("[data-article-reader-window-count]")?.getAttribute("data-article-reader-window-count")).toBe("1");
    expect(container.querySelectorAll(".article-reader")).toHaveLength(1);
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(fixture.nodeId);
    expect(container.querySelectorAll(".blog-tags")).toHaveLength(1);

    const readerQtTag = [...container.querySelectorAll<HTMLAnchorElement>(".article-reader__tags a")].find((tagLink) => tagLink.textContent === "Qt");
    if (!readerQtTag) throw new Error("Reader Qt tag missing.");
    act(() => readerQtTag.click());
    expect(window.location.hash).toBe("#/blog/tag/Qt");
    expect(container.querySelector("[data-blog-tags-window-count]")?.getAttribute("data-blog-tags-window-count")).toBe("1");
    expect(container.querySelector(".blog-tags__detail-heading")?.textContent).toContain("Tag: Qt");
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(fixture.nodeId);
  });
});
