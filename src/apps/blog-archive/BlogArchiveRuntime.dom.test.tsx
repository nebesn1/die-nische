// @vitest-environment jsdom
import { act, useMemo, useState, type ReactNode } from "react";
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

const now = "2026-09-14T00:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;

const addPublished = (state: VfsState): { readonly state: VfsState; readonly nodeId: string } => {
  const created = createVfsTextFile(state, "/home/user/Documents", "archive-runtime.md", "body", { now, mimeType: "text/markdown" });
  if (!created.ok) throw new Error("Expected published fixture creation to succeed.");
  const article = resolveVfsPath(created.state, "/home/user/Documents/archive-runtime.md");
  if (!article.ok || article.value.kind !== "file") throw new Error("Published fixture missing.");

  return {
    nodeId: article.value.id,
    state: {
      ...created.state,
      nodesById: {
        ...created.state.nodesById,
        [article.value.id]: {
          ...article.value,
          displayName: "Runtime Archive Article",
          publication: { status: "published", publishedAt: "2026-09-12T08:00:00.000Z", slug: "runtime-archive" },
        },
      },
    },
  };
};

function Fixture({ children, initialState }: { readonly children: ReactNode; readonly initialState: VfsState }) {
  const [state, setState] = useState(initialState);
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

function RuntimeControls() {
  const { launchApplication } = useApplicationLauncher();
  return <button type="button" onClick={() => launchApplication("blog")}>Open Blog</button>;
}

function RuntimeWindows() {
  const { windows } = useWindowManager();
  const archiveCount = windows.filter((desktopWindow) => desktopWindow.appId === "blog-archive").length;
  const readerCount = windows.filter((desktopWindow) => desktopWindow.appId === "article-reader").length;

  return (
    <section data-blog-archive-window-count={archiveCount} data-article-reader-window-count={readerCount}>
      {windows.map((desktopWindow) => <ApplicationHost key={desktopWindow.id} desktopWindow={desktopWindow} />)}
    </section>
  );
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

describe("Blog Archive runtime", () => {
  it("opens from Blog as one singleton and launches exactly one live Reader from a canonical archive entry", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent());
    act(() => {
      reactRoot.render(
        <Fixture initialState={fixture.state}>
          <WindowManagerProvider initialWindows={[]}>
            <ApplicationRuntimeProvider>
              <RuntimeControls />
              <RuntimeWindows />
            </ApplicationRuntimeProvider>
          </WindowManagerProvider>
        </Fixture>,
      );
    });

    const openBlog = container.querySelector<HTMLButtonElement>("button");
    if (!openBlog) throw new Error("Blog launcher missing.");
    act(() => openBlog.click());
    const archiveButton = [...container.querySelectorAll<HTMLButtonElement>(".blog-app__archive-button")][0];
    if (!archiveButton) throw new Error("Blog Archive control missing.");
    act(() => archiveButton.click());
    act(() => archiveButton.click());

    expect(container.querySelector("[data-blog-archive-window-count]")?.getAttribute("data-blog-archive-window-count")).toBe("1");
    const link = container.querySelector<HTMLAnchorElement>(`[data-blog-archive-node-id='${fixture.nodeId}'] .blog-archive__article-title`);
    if (!link) throw new Error("Archive article link missing.");
    act(() => link.click());

    expect(window.location.hash).toBe("#/blog/runtime-archive");
    expect(container.querySelector("[data-article-reader-window-count]")?.getAttribute("data-article-reader-window-count")).toBe("1");
    expect(container.querySelectorAll(".article-reader")).toHaveLength(1);
    expect(container.querySelector("[data-article-node-id]")?.getAttribute("data-article-node-id")).toBe(fixture.nodeId);
    expect(container.querySelectorAll(".blog-archive")).toHaveLength(1);
  });
});
