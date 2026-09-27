import { describe, expect, it } from "vitest";
import { parseMarkdownPreview } from "./markdownPreviewModel";

describe("Markdown preview parser", () => {
  it("renders the supported compact Markdown subset as inert blocks", () => {
    expect(parseMarkdownPreview("# Heading\n\n**Bold** and *italic* with `code`\n\n- One\n- Two\n\n> Quote\n\n```\nconst x = 1;\n```\n\n---")).toMatchObject([
      { type: "heading", depth: 1 },
      { type: "paragraph" },
      { type: "list", ordered: false },
      { type: "blockquote" },
      { type: "code", value: "const x = 1;" },
      { type: "rule" },
    ]);
  });

  it("keeps raw HTML as text and converts links/images into inert display nodes", () => {
    const blocks = parseMarkdownPreview('<script>alert(1)</script> [link](https://example.com) ![pixel](https://example.com/pixel.png)');
    expect(blocks).toMatchObject([
      {
        type: "paragraph",
        content: [
          { type: "text", value: "<script>alert(1)</script> " },
          { type: "link", label: "link", href: "https://example.com" },
          { type: "text", value: " " },
          { type: "image", alt: "pixel" },
        ],
      },
    ]);
  });

  it("recognizes only explicit HTML5 media blocks while keeping media links and fenced HTML inert", () => {
    const blocks = parseMarkdownPreview('Video link: [Demo](./demo.mp4)\n\n<video controls src="./demo.mp4">Fallback</video>\n\n```html\n<video src="./hidden.mp4"></video>\n```\n\n&lt;audio controls&gt;escaped&lt;/audio&gt;');
    expect(blocks).toMatchObject([
      { type: "paragraph" },
      { type: "html-media", value: '<video controls src="./demo.mp4">Fallback</video>' },
      { type: "code", value: '<video src="./hidden.mp4"></video>' },
      { type: "paragraph" },
    ]);
    expect(blocks[0]).toMatchObject({ content: [{ type: "text", value: "Video link: " }, { type: "link", href: "./demo.mp4" }] });
    expect(blocks[3]).toMatchObject({ content: [{ type: "text", value: "&lt;audio controls&gt;escaped&lt;/audio&gt;" }] });
  });
});
