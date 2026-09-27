import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { createVfsTextFile } from "../../vfs/mutations";
import { resolveVfsPath } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { BlogArchive } from "./BlogArchive";

const now = "2026-09-14T00:00:00.000Z";

const expectMutation = (result: ReturnType<typeof createVfsTextFile>): VfsState => {
  if (!result.ok) throw new Error("Expected text fixture creation to succeed.");
  return result.state;
};

const addPublished = (state: VfsState): VfsState => {
  const created = expectMutation(createVfsTextFile(state, "/home/user/Documents", "article.md", "text", { now, mimeType: "text/markdown" }));
  const article = resolveVfsPath(created, "/home/user/Documents/article.md");
  if (!article.ok || article.value.kind !== "file") throw new Error("Published fixture missing.");

  return {
    ...created,
    nodesById: {
      ...created.nodesById,
      [article.value.id]: {
        ...article.value,
        displayName: "Archive Article",
        publication: { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" },
      },
    },
  };
};

const makeVfsContextValue = (state: VfsState): VfsContextValue => ({
  state,
  ...createVfsOperations(() => state, () => undefined),
});

const renderArchive = (state: VfsState): string => renderToStaticMarkup(
  <ApplicationLauncherContext.Provider value={{
    launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
    launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened"),
  }}>
    <VfsContext.Provider value={makeVfsContextValue(state)}><BlogArchive /></VfsContext.Provider>
  </ApplicationLauncherContext.Provider>,
);

describe("Blog Archive", () => {
  it("projects only the live catalog and archive projection without independently sorting or selecting VFS publication nodes", () => {
    const source = readFileSync(new URL("./BlogArchive.tsx", import.meta.url), "utf8");

    expect(source).toContain("buildPublishedContentCatalog(vfs.state)");
    expect(source).toContain("buildPublishedArticleArchive(catalog)");
    expect(source).toContain("launchPublishedArticle(entry, { launchNewApplicationInstance })");
    expect(source).toContain("activatePublishedArticlePermalink(event, entry, { launchNewApplicationInstance })");
    expect(source).not.toContain(".sort(");
    expect(source).not.toContain("isVfsFilePublished");
    expect(source).not.toContain("isVfsNodeInsideTrash");
    expect(source).not.toContain("entry.aliases");
  });

  it("renders a compact empty state and catalog title/date without summary or tag rows", () => {
    expect(renderArchive(createVfsTestStateWithoutRepositoryContent())).toContain("No published articles yet.");

    const markup = renderArchive(addPublished(createVfsTestStateWithoutRepositoryContent()));
    expect(markup).toContain("Blog Archive");
    expect(markup).toContain("2026");
    expect(markup).toContain("September");
    expect(markup).toContain("Archive Article");
    expect(markup).toContain(`Published ${formatTimestampForLocalDisplay("2026-09-12T08:00:00.000Z")}`);
    expect(markup).not.toContain("blog-archive__summary");
    expect(markup).not.toContain("blog-archive__tags");
  });
});
