import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { createVfsAssetUrlFileContent } from "../../vfs/fileContent";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsTextFile } from "../../vfs/mutations";
import { resolveVfsPath } from "../../vfs/queries";
import type { VfsPublicationMetadata, VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { ArticleReader } from "./ArticleReader";
import { createArticleReaderOpenIntent } from "./launchIntent";

const now = "2026-09-14T00:00:00.000Z";

const expectMutation = <T,>(result: { readonly ok: true; readonly state: VfsState; readonly value: T } | { readonly ok: false }): { readonly state: VfsState; readonly value: T } => {
  if (!result.ok) throw new Error("Expected fixture mutation to succeed.");
  return result;
};

const addPublished = (state: VfsState, name: string, content: string, mimeType: string, publication: VfsPublicationMetadata, displayName?: string): VfsState => {
  const created = expectMutation(createVfsTextFile(state, "/home/user/Documents", name, content, { now, mimeType })).state;
  const resolved = resolveVfsPath(created, `/home/user/Documents/${name}`);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error("Fixture file missing.");
  return { ...created, nodesById: { ...created.nodesById, [resolved.value.id]: { ...resolved.value, publication, ...(displayName === undefined ? {} : { displayName }) } } };
};

const renderReader = (state: VfsState, nodeId: string): string => {
  const context: VfsContextValue = { state, ...createVfsOperations(() => state, () => undefined) };
  return renderToStaticMarkup(
    <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
      <VfsContext.Provider value={context}><ArticleReader launchRequest={{ requestId: 1, intent: createArticleReaderOpenIntent(nodeId) }} /></VfsContext.Provider>
    </ApplicationLauncherContext.Provider>,
  );
};

describe("ArticleReader", () => {
  it("renders the live catalog header, canonical source path, and Markdown body through the shared safe renderer", () => {
    const state = addPublished(createInitialVfsState(), "article.md", "---\ntitle: Article Title\n---\n# Body\n\nThis is **safe**.", "text/markdown", {
      status: "published", slug: "article-title", publishedAt: "2026-09-12T08:00:00.000Z", summary: "Summary", tags: ["Qt", "Godot", "机器人"],
    }, "Article Title");
    const article = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!article.ok) throw new Error("Article missing.");
    const markup = renderReader(state, article.value.id);

    expect(markup).toContain("Article Title");
    expect(markup).toContain(`Published ${formatTimestampForLocalDisplay("2026-09-12T08:00:00.000Z")}`);
    expect(markup).toContain("Summary");
    expect(markup).toContain("Tags: <a href=\"#/blog/tag/Qt\">Qt</a>, <a href=\"#/blog/tag/Godot\">Godot</a>, <a href=\"#/blog/tag/%E6%9C%BA%E5%99%A8%E4%BA%BA\">机器人</a>");
    expect(markup).toContain("Source: /home/user/Documents/article.md");
    expect(markup).toContain('href="#/blog/article-title"');
    expect(markup).toContain("Body");
    expect(markup).toContain("<strong>safe</strong>");
    expect(markup).not.toContain("publication:");
    expect(markup).not.toContain("title: Article Title");
  });

  it("omits absent optional presentation metadata and safely renders plain text and sanitized HTML", () => {
    let state = addPublished(createInitialVfsState(), "plain.txt", "<b>literal</b>\nline two", "text/plain", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    state = addPublished(state, "safe.html", "<h2>HTML</h2><script>unsafe()</script><a href='javascript:alert(1)'>Bad</a>", "text/html", { status: "published", publishedAt: "2026-09-11T08:00:00.000Z" });
    const plain = resolveVfsPath(state, "/home/user/Documents/plain.txt");
    const html = resolveVfsPath(state, "/home/user/Documents/safe.html");
    if (!plain.ok || !html.ok) throw new Error("Fixtures missing.");

    const plainMarkup = renderReader(state, plain.value.id);
    const htmlMarkup = renderReader(state, html.value.id);
    expect(plainMarkup).toContain("&lt;b&gt;literal&lt;/b&gt;");
    expect(plainMarkup).not.toContain("article-reader__summary");
    expect(plainMarkup).not.toContain("article-reader__tags");
    expect(plainMarkup).not.toContain("article-reader__permalink");
    expect(htmlMarkup).toContain("HTML");
    expect(htmlMarkup).not.toContain("unsafe()");
    expect(htmlMarkup).not.toContain('<a href="javascript:');
  });

  it("uses only a stable nodeId payload and does not expose unpublished content", () => {
    const state = addPublished(createInitialVfsState(), "draft.md", "Private body", "text/markdown", { status: "draft" });
    const draft = resolveVfsPath(state, "/home/user/Documents/draft.md");
    if (!draft.ok) throw new Error("Draft missing.");
    const markup = renderReader(state, draft.value.id);

    expect(markup).toContain("This article is no longer available.");
    expect(markup).not.toContain("Private body");
  });

  it("resolves Markdown relative VFS images through the shared asset boundary", () => {
    let state = addPublished(createInitialVfsState(), "article.md", "![Picture](../Pictures/reader.png)\n\n![Missing](missing.png)", "text/markdown", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    const imageState = expectMutation(createVfsTextFile(state, "/home/user/Pictures", "reader.png", "", { now, mimeType: "image/png" })).state;
    const image = resolveVfsPath(imageState, "/home/user/Pictures/reader.png");
    const article = resolveVfsPath(imageState, "/home/user/Documents/article.md");
    if (!image.ok || image.value.kind !== "file" || !article.ok) throw new Error("Image fixtures missing.");
    state = { ...imageState, nodesById: { ...imageState.nodesById, [image.value.id]: { ...image.value, content: createVfsAssetUrlFileContent("/assets/reader.png") } } };

    const markup = renderReader(state, article.value.id);
    expect(markup).toContain('src="/assets/reader.png"');
    expect(markup).not.toContain('src="../Pictures/reader.png"');
    expect(markup).toContain("[Image: Missing]");
  });

  it("renders explicit article media with source-relative asset URLs and native fallback text", () => {
    let state = addPublished(createInitialVfsState(), "article.md", '<video controls poster="../Pictures/poster.png"><source src="./demo.mp4" type="video/mp4">Video fallback</video>\n\n<audio controls src="./demo.mp3">Audio fallback</audio>', "text/markdown", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    const videoCreated = expectMutation(createVfsTextFile(state, "/home/user/Documents", "demo.mp4", "", { now, mimeType: "video/mp4" }));
    const audioCreated = expectMutation(createVfsTextFile(videoCreated.state, "/home/user/Documents", "demo.mp3", "", { now, mimeType: "audio/mpeg" }));
    const posterCreated = expectMutation(createVfsTextFile(audioCreated.state, "/home/user/Pictures", "poster.png", "", { now, mimeType: "image/png" }));
    const video = resolveVfsPath(posterCreated.state, "/home/user/Documents/demo.mp4");
    const audio = resolveVfsPath(posterCreated.state, "/home/user/Documents/demo.mp3");
    const poster = resolveVfsPath(posterCreated.state, "/home/user/Pictures/poster.png");
    const article = resolveVfsPath(posterCreated.state, "/home/user/Documents/article.md");
    if (!video.ok || video.value.kind !== "file" || !audio.ok || audio.value.kind !== "file" || !poster.ok || poster.value.kind !== "file" || !article.ok) throw new Error("Media fixtures missing.");
    state = {
      ...posterCreated.state,
      nodesById: {
        ...posterCreated.state.nodesById,
        [video.value.id]: { ...video.value, content: createVfsAssetUrlFileContent("/assets/demo.mp4") },
        [audio.value.id]: { ...audio.value, content: createVfsAssetUrlFileContent("/assets/demo.mp3") },
        [poster.value.id]: { ...poster.value, content: createVfsAssetUrlFileContent("/assets/poster.png") },
      },
    };

    const markup = renderReader(state, article.value.id);
    expect(markup).toContain('<video controls="" poster="/assets/poster.png">');
    expect(markup).toContain('<source src="/assets/demo.mp4" type="video/mp4"/>');
    expect(markup).toContain('<audio src="/assets/demo.mp3" controls="">Audio fallback</audio>');
    expect(markup).toContain("Video fallback");
  });
});
