import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import { VfsContext } from "../../vfs/VfsContext";
import { BlogTags } from "./BlogTags";

const renderTags = (): string => {
  const state = createVfsTestStateWithoutRepositoryContent();
  return renderToStaticMarkup(
    <ApplicationLauncherContext.Provider value={{
      launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
      launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened"),
    }}>
      <VfsContext.Provider value={{ state, ...createVfsOperations(() => state, () => undefined) }}><BlogTags /></VfsContext.Provider>
    </ApplicationLauncherContext.Provider>,
  );
};

describe("Blog Tags", () => {
  it("consumes catalog and pure tag projection without VFS selection, local article sorting, locale comparison, or copied selected entries", () => {
    const source = readFileSync(new URL("./BlogTags.tsx", import.meta.url), "utf8");

    expect(source).toContain("buildPublishedContentCatalog(vfs.state)");
    expect(source).toContain("buildPublishedArticleTagIndex(catalog)");
    expect(source).toContain("tagIndex.find");
    expect(source).toContain("formatPublishedTagHash(group.tag)");
    expect(source).toContain("activatePublishedTagPermalink(event, group.tag, setSelectedTag)");
    expect(source).toContain("isBlogTagsOpenIntent");
    expect(source).toContain("launchPublishedArticle(entry, { launchNewApplicationInstance })");
    expect(source).toContain("activatePublishedArticlePermalink(event, entry, { launchNewApplicationInstance })");
    expect(source).not.toContain(".sort(");
    expect(source).not.toContain("localeCompare");
    expect(source).not.toContain("isVfsFilePublished");
    expect(source).not.toContain("entry.aliases");
    expect(source).not.toContain("const activateTagPermalink");
  });

  it("renders the Blog Tags heading and empty-state contract", () => {
    const markup = renderTags();

    expect(markup).toContain("<h1>Blog Tags</h1>");
    expect(markup).toContain("No published tags yet.");
  });
});
