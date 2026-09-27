import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { I18nContext } from "../../i18n/I18nContext";
import type { DesktopLocale } from "../../i18n/locale";
import { createTranslator } from "../../i18n/translate";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { createVfsTextFile } from "../../vfs/mutations";
import { resolveVfsPath } from "../../vfs/queries";
import type { VfsPublicationMetadata, VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { Blog } from "./Blog";

const now = "2026-09-14T00:00:00.000Z";

const expectMutation = (result: ReturnType<typeof createVfsTextFile>): { readonly state: VfsState } => {
  if (!result.ok) throw new Error("Expected text fixture creation to succeed.");
  return result;
};

const addText = (state: VfsState, name: string): VfsState =>
  expectMutation(createVfsTextFile(state, "/home/user/Documents", name, "text", { now, mimeType: "text/markdown" })).state;

const setPublication = (state: VfsState, name: string, publication: VfsPublicationMetadata, displayName?: string): VfsState => {
  const resolved = resolveVfsPath(state, `/home/user/Documents/${name}`);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error(`Missing '${name}'.`);
  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [resolved.value.id]: { ...resolved.value, publication, ...(displayName === undefined ? {} : { displayName }) },
    },
  };
};

const makeVfsContextValue = (state: VfsState): VfsContextValue => ({
  state,
  ...createVfsOperations(() => state, () => undefined),
});

const renderBlog = (state: VfsState, locale: DesktopLocale = "en"): string => renderToStaticMarkup(
  <ApplicationLauncherContext.Provider value={{
    launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
    launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened"),
  }}>
    <I18nContext.Provider value={{ locale, t: createTranslator(locale) }}>
      <VfsContext.Provider value={makeVfsContextValue(state)}><Blog /></VfsContext.Provider>
    </I18nContext.Provider>
  </ApplicationLauncherContext.Provider>,
);

describe("Blog", () => {
  it("consumes the Phase 5.73 catalog without duplicating VFS publication selection or sorting", () => {
    const source = readFileSync(new URL("./Blog.tsx", import.meta.url), "utf8");

    expect(source).toContain("buildPublishedContentCatalog(vfs.state)");
    expect(source).toContain('launchApplication("blog-archive")');
    expect(source).toContain('launchApplication("blog-tags")');
    expect(source).toContain('launchApplication("blog-search")');
    expect(source).toContain("launchPublishedArticle(entry, { launchNewApplicationInstance })");
    expect(source).toContain("activatePublishedArticlePermalink(event, entry, { launchNewApplicationInstance })");
    expect(source).toContain("entry.title");
    expect(source).not.toContain(".sort(");
    expect(source).not.toContain("isVfsFilePublished");
    expect(source).not.toContain("isVfsNodeInsideTrash");
    expect(source).not.toContain("displayName ??");
    expect(source).not.toContain("planKonquerorNodeOpen");
  });

  it("renders a normal empty catalog state", () => {
    const markup = renderBlog(createVfsTestStateWithoutRepositoryContent());

    expect(markup).toContain("<h1>Blog</h1>");
    expect(markup).toContain(">Archive</button>");
    expect(markup).toContain(">Tags</button>");
    expect(markup).toContain(">Search</button>");
    expect(markup).toContain("No published articles yet.");
    expect(markup).toContain("0 published articles");
  });

  it("renders catalog-projected title, date, plain summary, and authored tag order", () => {
    let state = addText(createVfsTestStateWithoutRepositoryContent(), "article.md");
    state = setPublication(state, "article.md", {
      status: "published",
      publishedAt: "2026-09-12T08:00:00.000Z",
      summary: "A plain summary.",
      tags: ["Qt", "Godot", "机器人"],
    }, "My Article");
    const markup = renderBlog(state);

    expect(markup).toContain("My Article");
    expect(markup).toContain(`Published ${formatTimestampForLocalDisplay("2026-09-12T08:00:00.000Z")}`);
    expect(markup).toContain("A plain summary.");
    expect(markup).toContain("Tags: <a href=\"#/blog/tag/Qt\">Qt</a>, <a href=\"#/blog/tag/Godot\">Godot</a>, <a href=\"#/blog/tag/%E6%9C%BA%E5%99%A8%E4%BA%BA\">机器人</a>");
    expect(markup).toContain('data-blog-node-id=');
  });

  it("omits optional summary and tags instead of synthesizing article content", () => {
    let state = addText(createVfsTestStateWithoutRepositoryContent(), "minimal.md");
    state = setPublication(state, "minimal.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    const markup = renderBlog(state);

    expect(markup).toContain("minimal.md");
    expect(markup).not.toContain("blog-article__summary");
    expect(markup).not.toContain("blog-article__tags");
    expect(markup).not.toContain("No summary");
  });

  it("renders the Phase 5.73 catalog order directly, including duplicate titles, while excluding draft and unmanaged files", () => {
    let state = addText(createVfsTestStateWithoutRepositoryContent(), "older.md");
    state = addText(state, "newer.md");
    state = addText(state, "draft.md");
    state = addText(state, "plain.md");
    state = setPublication(state, "older.md", { status: "published", publishedAt: "2026-09-10T08:00:00.000Z" }, "Alpha");
    state = setPublication(state, "newer.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" }, "Zebra");
    state = setPublication(state, "draft.md", { status: "draft" }, "Draft article");
    const markup = renderBlog(state);

    const newer = markup.indexOf(">Zebra</button>");
    const older = markup.indexOf(">Alpha</button>");
    expect(newer).toBeGreaterThan(-1);
    expect(older).toBeGreaterThan(newer);
    expect(markup).not.toContain("Draft article");
    expect(markup).not.toContain("plain.md");
  });

  it("localizes application chrome without translating authored article data", () => {
    let state = addText(createVfsTestStateWithoutRepositoryContent(), "article.md");
    state = setPublication(state, "article.md", {
      status: "published",
      publishedAt: "2026-09-12T08:00:00.000Z",
      summary: "Authored summary.",
      tags: ["AuthoredTag"],
    }, "Authored title");
    const markup = renderBlog(state, "zh-CN");

    expect(markup).toContain(">归档</button>");
    expect(markup).toContain("标签：");
    expect(markup).toContain("Authored title");
    expect(markup).toContain("Authored summary.");
    expect(markup).toContain("AuthoredTag");
    expect(markup).not.toContain(">Archive</button>");
  });
});
