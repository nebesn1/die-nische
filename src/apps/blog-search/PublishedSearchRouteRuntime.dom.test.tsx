// @vitest-environment jsdom
import { act, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApplicationHost } from "../../application-runtime/ApplicationHost";
import { ApplicationRuntimeProvider } from "../../application-runtime/ApplicationRuntimeProvider";
import { PublishedArticleRouteController } from "../../desktop/PublishedArticleRouteController";
import { PublishedSearchRouteController } from "../../desktop/PublishedSearchRouteController";
import { createVfsTextFile, writeVfsTextFile } from "../../vfs/mutations";
import { resolveVfsPath } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import { VfsContext } from "../../vfs/VfsContext";
import { useWindowManager } from "../../window-manager/useWindowManager";
import { WindowManagerProvider } from "../../window-manager/WindowManagerProvider";

const now = "2026-09-17T08:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let setFixtureState: Dispatch<SetStateAction<VfsState>>;

const addPublished = (state: VfsState): { readonly state: VfsState; readonly nodeId: string } => {
  const created = createVfsTextFile(state, "/home/user/Documents", "routed-search.md", "Initial ROBOTTOKEN body", { now, mimeType: "text/markdown" });
  if (!created.ok) throw new Error("Expected routed Search fixture creation to succeed.");
  const article = resolveVfsPath(created.state, "/home/user/Documents/routed-search.md");
  if (!article.ok || article.value.kind !== "file") throw new Error("Routed Search fixture missing.");

  return {
    nodeId: article.value.id,
    state: {
      ...created.state,
      nodesById: {
        ...created.state.nodesById,
        [article.value.id]: {
          ...article.value,
          displayName: "Routed Robot Search",
          publication: { status: "published", publishedAt: now, slug: "routed-search", summary: "Robot query summary", tags: ["Web"] },
        },
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

function RuntimeWindows() {
  const { windows } = useWindowManager();
  const searchCount = windows.filter((desktopWindow) => desktopWindow.appId === "blog-search").length;
  const readerCount = windows.filter((desktopWindow) => desktopWindow.appId === "article-reader").length;
  return <section data-blog-search-window-count={searchCount} data-article-reader-window-count={readerCount}>
    {windows.map((desktopWindow) => <ApplicationHost key={desktopWindow.id} desktopWindow={desktopWindow} />)}
  </section>;
}

const renderRuntime = (state: VfsState) => {
  act(() => {
    reactRoot.render(
      <Fixture initialState={state}>
        <WindowManagerProvider initialWindows={[]}>
          <ApplicationRuntimeProvider>
            <PublishedArticleRouteController />
            <PublishedSearchRouteController />
            <RuntimeWindows />
          </ApplicationRuntimeProvider>
        </WindowManagerProvider>
      </Fixture>,
    );
  });
};

const navigateHash = (hash: string) => {
  act(() => {
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new PopStateEvent("popstate"));
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
});

describe("Published Search route runtime", () => {
  it("opens one live Search singleton from a deep link, including zero-result updates and live snippet refresh", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent());
    window.history.replaceState(null, "", "#/blog/search/robot");
    renderRuntime(fixture.state);

    expect(container.querySelector("[data-blog-search-window-count]")?.getAttribute("data-blog-search-window-count")).toBe("1");
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("robot");
    expect(container.querySelector(`[data-blog-search-node-id='${fixture.nodeId}'] .blog-search__snippet .blog-search__match`)?.textContent).toBe("ROBOT");

    navigateHash("#/blog/search/zzzz-no-results");
    expect(container.querySelector("[data-blog-search-window-count]")?.getAttribute("data-blog-search-window-count")).toBe("1");
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("zzzz-no-results");
    expect(container.textContent).toContain("No published articles match your search.");

    navigateHash("#/blog/search/robot");
    const written = writeVfsTextFile(fixture.state, "/home/user/Documents/routed-search.md", "Updated ROBOTTOKEN live body", { now });
    if (!written.ok) throw new Error("Expected routed Search fixture update to succeed.");
    act(() => setFixtureState(written.state));
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("robot");
    expect(container.querySelector(`[data-blog-search-node-id='${fixture.nodeId}'] .blog-search__snippet`)?.textContent).toContain("Updated ROBOTTOKEN live body");
  });

  it("keeps one Search window through result activation and a browser-history return to its query route", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent());
    window.history.replaceState(null, "", "#/blog/search/robot");
    renderRuntime(fixture.state);
    const title = container.querySelector<HTMLAnchorElement>(`[data-blog-search-node-id='${fixture.nodeId}'] .blog-search__article-title`);
    if (!title) throw new Error("Routed Search article link missing.");

    act(() => title.click());
    expect(window.location.hash).toBe("#/blog/routed-search");
    expect(container.querySelector("[data-article-reader-window-count]")?.getAttribute("data-article-reader-window-count")).toBe("1");
    expect(container.querySelector("[data-blog-search-window-count]")?.getAttribute("data-blog-search-window-count")).toBe("1");

    navigateHash("#/blog/search/robot");
    expect(container.querySelector<HTMLInputElement>("#blog-search-query")?.value).toBe("robot");
    expect(container.querySelector("[data-blog-search-window-count]")?.getAttribute("data-blog-search-window-count")).toBe("1");
    expect(container.querySelector("[data-article-reader-window-count]")?.getAttribute("data-article-reader-window-count")).toBe("1");
  });
});
