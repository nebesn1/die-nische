// @vitest-environment jsdom
import { act, StrictMode, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../application-runtime/types";
import { ApplicationLauncherContext } from "../application-runtime/useApplicationLauncher";
import { createVfsTextFile } from "../vfs/mutations";
import { resolveVfsPath } from "../vfs/queries";
import type { VfsPublicationMetadata, VfsState } from "../vfs/types";
import { createVfsOperations } from "../vfs/vfsOperations";
import { VfsContext } from "../vfs/VfsContext";
import { createVfsTestStateWithoutRepositoryContent } from "../vfs/testFixtures";
import { PublishedTagRouteController } from "./PublishedTagRouteController";

const now = "2026-09-15T08:00:00.000Z";
let container: HTMLDivElement;
let reactRoot: Root;
let setFixtureState: Dispatch<SetStateAction<VfsState>>;
let launchApplication: ReturnType<typeof vi.fn>;

const addPublished = (state: VfsState, name: string, tag: string): { readonly state: VfsState; readonly nodeId: string } => {
  const created = createVfsTextFile(state, "/home/user/Documents", name, "body", { now, mimeType: "text/markdown" });
  if (!created.ok) throw new Error("Fixture creation failed.");
  const article = resolveVfsPath(created.state, `/home/user/Documents/${name}`);
  if (!article.ok || article.value.kind !== "file") throw new Error("Fixture missing.");
  const publication: VfsPublicationMetadata = { status: "published", publishedAt: "2026-09-14T08:00:00.000Z", slug: name.slice(0, -3), tags: [tag] };
  return {
    nodeId: article.value.id,
    state: { ...created.state, nodesById: { ...created.state.nodesById, [article.value.id]: { ...article.value, publication } } },
  };
};

function Fixture({ initialState, children }: { readonly initialState: VfsState; readonly children: ReactNode }) {
  const [state, setState] = useState(initialState);
  setFixtureState = setState;
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const renderController = (state: VfsState) => {
  launchApplication = vi.fn((): LaunchApplicationResult => "opened");
  act(() => {
    reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
        <Fixture initialState={state}><PublishedTagRouteController /></Fixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    );
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

describe("PublishedTagRouteController", () => {
  it("canonicalizes a resolvable raw-plus deep link once and deduplicates browser events", () => {
    const fixture = addPublished(createVfsTestStateWithoutRepositoryContent(), "plus.md", "C++");
    window.history.replaceState(null, "", "#/blog/tag/C++");
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderController(fixture.state);

    expect(window.location.hash).toBe("#/blog/tag/C%2B%2B");
    expect(replaceState).toHaveBeenCalledWith(null, "", "#/blog/tag/C%2B%2B");
    expect(launchApplication).toHaveBeenCalledTimes(1);
    expect(launchApplication).toHaveBeenCalledWith("blog-tags", { intent: { type: "open-blog-tags", selectedTag: "C++" } });
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(launchApplication).toHaveBeenCalledTimes(1);
  });

  it("updates exact route selections, ignores unresolved hashes, and re-resolves after a group returns", () => {
    const qt = addPublished(createVfsTestStateWithoutRepositoryContent(), "qt.md", "Qt");
    const web = addPublished(qt.state, "web.md", "Web");
    window.history.replaceState(null, "", "#/blog/tag/Qt");
    renderController(web.state);
    expect(launchApplication).toHaveBeenLastCalledWith("blog-tags", { intent: { type: "open-blog-tags", selectedTag: "Qt" } });

    act(() => {
      window.history.replaceState(null, "", "#/blog/tag/Web");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(launchApplication).toHaveBeenLastCalledWith("blog-tags", { intent: { type: "open-blog-tags", selectedTag: "Web" } });
    expect(launchApplication).toHaveBeenCalledTimes(2);

    const replaceState = vi.spyOn(window.history, "replaceState");
    act(() => {
      window.history.replaceState(null, "", "#/blog/tag/QT");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(launchApplication).toHaveBeenCalledTimes(2);
    expect(window.location.hash).toBe("#/blog/tag/QT");
    expect(replaceState).not.toHaveBeenCalledWith(null, "", "#/blog/tag/Qt");

    act(() => {
      window.history.replaceState(null, "", "#/blog/tag/Qt");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    const removed: VfsState = { ...web.state, nodesById: { ...web.state.nodesById, [qt.nodeId]: {
      ...(web.state.nodesById[qt.nodeId] as Extract<VfsState["nodesById"][string], { readonly kind: "file" }>),
      publication: { status: "published", publishedAt: "2026-09-14T08:00:00.000Z", tags: [] },
    } } };
    act(() => setFixtureState(removed));
    expect(launchApplication).toHaveBeenCalledTimes(3);
    act(() => setFixtureState(web.state));
    expect(launchApplication).toHaveBeenCalledTimes(4);
    expect(launchApplication).toHaveBeenLastCalledWith("blog-tags", { intent: { type: "open-blog-tags", selectedTag: "Qt" } });
  });
});
