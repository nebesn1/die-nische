import { createRef } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VfsFileNode } from "../../vfs/types";
import { KonquerorPrintSurface } from "./KonquerorPrintSurface";
import type { KonquerorPrintDocument } from "./konquerorPrintContext";

const file = (name: string, mimeType: string, content: string): VfsFileNode => ({
  id: `vfs-${name}`,
  name,
  parentId: "vfs-documents",
  kind: "file",
  encoding: "utf-8",
  mimeType,
  content: { kind: "text", text: content },
  size: content.length,
  createdAt: "2026-08-01T00:00:00.000Z",
  modifiedAt: "2026-08-01T00:00:00.000Z",
});

const renderPrintSurface = (document: KonquerorPrintDocument): string =>
  renderToStaticMarkup(
    <KonquerorPrintSurface
      surfaceRef={createRef()}
      printRequest={{ requestId: 7, windowId: "konqueror-exact-window", document }}
    />,
  );

describe("KonquerorPrintSurface", () => {
  it("renders the exact request outside screen-preview containers", () => {
    const markup = renderPrintSurface({ kind: "about" });

    expect(markup).toContain('class="konqueror-print-surface"');
    expect(markup).toContain('data-print-request-id="7"');
    expect(markup).toContain('data-print-window-id="konqueror-exact-window"');
    expect(markup).toContain("Conquer your Desktop!");
    expect(markup).not.toContain("window-frame");
    expect(markup).not.toContain("konqueror-toolbar");
  });

  it("keeps full Text content in normal print representation and preserves safe wrapping semantics", () => {
    const longLine = "unbroken".repeat(1_000);
    const content = `First line\n${longLine}\nFinal line`;
    const markup = renderPrintSurface({ kind: "file", file: file("Long.txt", "text/plain", content), previewerId: "embedded-text" });

    expect(markup).toContain("First line");
    expect(markup).toContain(longLine);
    expect(markup).toContain("Final line");
    expect(markup).toContain("konqueror-file-view__content");
  });

  it("renders a KWrite text request as document content without desktop chrome", () => {
    const markup = renderPrintSurface({ kind: "text", title: "Draft.txt", content: "First line\nSecond line" });

    expect(markup).toContain('class="kwrite-print-document"');
    expect(markup).toContain("Draft.txt");
    expect(markup).toContain("First line\nSecond line");
    expect(markup).not.toContain("window-frame");
    expect(markup).not.toContain("konqueror-toolbar");
  });

  it("reuses inert KHTML and rendered Markdown semantics rather than live DOM cloning", () => {
    const khtml = renderPrintSurface({
      kind: "file",
      file: file("Long.html", "text/html", "<h1>Safe heading</h1><script>alert(1)</script><p>Final paragraph</p>"),
      previewerId: "khtml",
    });
    const markdown = renderPrintSurface({
      kind: "file",
      file: file("Long.md", "text/markdown", "# Rendered heading\n\n**Final paragraph**"),
      previewerId: "markdown",
    });

    expect(khtml).toContain("Safe heading");
    expect(khtml).toContain("Final paragraph");
    expect(khtml).not.toContain("alert(1)");
    expect(markdown).toContain("Rendered heading");
    expect(markdown).toContain("Final paragraph");
    expect(markdown).not.toContain("konqueror-file-view__content");
  });

  it("prints a local image through the shared typed file-preview request without window chrome", () => {
    const markup = renderPrintSurface({
      kind: "file",
      file: { ...file("A.png", "image/png", ""), content: { kind: "asset-url", url: "data:image/png;base64,AA==" } },
      previewerId: "image",
    });

    expect(markup).toContain("konqueror-image-view");
    expect(markup).toContain('src="data:image/png;base64,AA=="');
    expect(markup).not.toContain("konqueror-toolbar");
  });

  it("keeps request creation independent from WindowFrame and viewport geometry", () => {
    const source = readFileSync("src/apps/konqueror/KonquerorPrintContext.tsx", "utf8");

    expect(source).toContain("flushSync");
    expect(source).toContain("window.print()");
    expect(source).not.toContain("useWindowManager");
    expect(source).not.toContain("workArea");
    expect(source).not.toContain("screenArea");
    expect(source).not.toContain("getBoundingClientRect");
    expect(source).not.toContain("innerWidth");
  });
});
