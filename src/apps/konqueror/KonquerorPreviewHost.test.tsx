import { readFileSync } from "node:fs";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VfsTextFileNode } from "../../vfs/types";
import { KonquerorPreviewHost } from "./KonquerorPreviewHost";

const file = (name: string, content: string): VfsTextFileNode => ({
  id: name,
  name,
  parentId: "documents",
  kind: "file",
  encoding: "utf-8",
  mimeType: "text/plain",
  content: { kind: "text", text: content },
  size: content.length,
  createdAt: "2026-08-01T00:00:00.000Z",
  modifiedAt: "2026-08-01T00:00:00.000Z",
});

describe("KonquerorPreviewHost", () => {
  it("renders KHTML and Markdown as local focusable read-only document surfaces", () => {
    const khtml = renderToStaticMarkup(<KonquerorPreviewHost file={file("page.html", "<h1>Hello</h1><script>alert(1)</script><img src='https://example.com/x' alt='pixel'>")} previewerId="khtml" previewSurfaceRef={createRef()} onOpenContextMenu={() => undefined} />);
    const markdown = renderToStaticMarkup(<KonquerorPreviewHost file={file("README.md", "# Hello\n\n**World**\n\n![pixel](https://example.com/x)")} previewerId="markdown" previewSurfaceRef={createRef()} onOpenContextMenu={() => undefined} />);
    const source = renderToStaticMarkup(<KonquerorPreviewHost file={file("page.html", "<h1>Hello</h1>")} previewerId="embedded-text" previewSurfaceRef={createRef()} onOpenContextMenu={() => undefined} />);

    expect(khtml).toContain('aria-label="page.html KHTML preview"');
    expect(khtml).toContain("Hello");
    expect(khtml).not.toContain("alert(1)");
    expect(khtml).toContain("[Image: pixel]");
    expect(markdown).toContain("Hello");
    expect(markdown).toContain("World");
    expect(markdown).toContain("[Image: pixel]");
    expect(source).toContain("&lt;h1&gt;Hello&lt;/h1&gt;");
    expect(source).toContain('tabindex="-1"');
  });

  it("keeps raw preview content out of HTML injection and browser navigation APIs", () => {
    const source = readFileSync(new URL("./KonquerorPreviewHost.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("innerHTML");
    expect(source).not.toContain("window.open");
    expect(source).not.toContain("location.href");
    expect(source).not.toContain("<iframe");
  });

  it("renders an image from its stored asset URL rather than a virtual VFS path", () => {
    const image = renderToStaticMarkup(
      <KonquerorPreviewHost
        file={{ ...file("A.png", ""), mimeType: "image/png", content: { kind: "asset-url", url: "/assets/A-abc.png" } }}
        previewerId="image"
        previewSurfaceRef={createRef()}
        onOpenContextMenu={() => undefined}
      />,
    );

    expect(image).toContain('class="konqueror-image-view');
    expect(image).toContain('src="/assets/A-abc.png"');
    expect(image).not.toContain("/home/user/Pictures/A.png");
  });
});
