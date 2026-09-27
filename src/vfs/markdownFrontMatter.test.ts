import { describe, expect, it } from "vitest";
import { parseMarkdownDocument } from "./markdownFrontMatter";

const publication = `
publication:
  status: published
  slug: phase-5-134
  publishedAt: "2026-09-26T12:00:00.000Z"
  summary: "Front matter summary: 保留"
  tags:
    - Qt
    - KDE
`;

describe("Markdown front matter", () => {
  it("resolves title/publication and returns only the Markdown body", () => {
    const parsed = parseMarkdownDocument(`---\ntitle: "Phase 5.134"${publication}---\n\n# Body\n\n![Media](./clip.mp4)\n`);

    expect(parsed).toEqual({
      hasFrontMatter: true,
      frontMatter: {
        title: "Phase 5.134",
        publication: {
          status: "published",
          slug: "phase-5-134",
          publishedAt: "2026-09-26T12:00:00.000Z",
          summary: "Front matter summary: 保留",
          tags: ["Qt", "KDE"],
        },
      },
      body: "\n# Body\n\n![Media](./clip.mp4)\n",
    });
  });

  it("supports a BOM and CRLF without treating a later horizontal rule as front matter", () => {
    const parsed = parseMarkdownDocument("\uFEFF---\r\ntitle: \"CRLF\"\r\n---\r\n# Body\r\n");
    expect(parsed.frontMatter?.title).toBe("CRLF");
    expect(parsed.body).toBe("# Body\r\n");
    expect(parseMarkdownDocument("# Before\n\n---\n\nAfter")).toMatchObject({
      hasFrontMatter: false,
      body: "# Before\n\n---\n\nAfter",
    });
  });

  it("keeps ordinary Markdown without front matter unchanged", () => {
    expect(parseMarkdownDocument("# Heading\n\nBody")).toEqual({ hasFrontMatter: false, frontMatter: null, body: "# Heading\n\nBody" });
  });

  it("rejects malformed, unterminated, and incomplete publication front matter", () => {
    expect(() => parseMarkdownDocument("---\ntitle: [broken\n---\nBody")).toThrow(/invalid YAML/);
    expect(() => parseMarkdownDocument("---\ntitle: Missing closing\nBody")).toThrow(/unterminated front matter block/);
    expect(() => parseMarkdownDocument("---\npublication:\n  status: published\n  slug: article\n  publishedAt: \"2026-09-26T12:00:00.000Z\"\n---\nBody")).toThrow(/requires a title/);
    expect(() => parseMarkdownDocument("---\ntitle: Article\npublication:\n  status: Published\n---\nBody")).toThrow(/requires status/);
  });

  it("allows unrelated front matter keys while keeping publication fields typed", () => {
    const parsed = parseMarkdownDocument("---\nlayout: article\ntitle: Article\n---\nBody");
    expect(parsed.frontMatter).toEqual({ title: "Article" });
    expect(parsed.body).toBe("Body");
  });
});
