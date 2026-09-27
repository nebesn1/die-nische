import { describe, expect, it } from "vitest";
import { parseSafeHtmlPreview } from "./htmlPreviewModel";

describe("safe KHTML preview parser", () => {
  it("keeps allow-listed document structure and text without exposing arbitrary attributes", () => {
    expect(parseSafeHtmlPreview("<h1>Hello</h1><p><strong>World</strong></p><table><tr><td>Cell</td></tr></table>")).toMatchObject([
      { type: "element", tag: "h1", children: [{ type: "text", value: "Hello" }] },
      { type: "element", tag: "p", children: [{ type: "element", tag: "strong", children: [{ type: "text", value: "World" }] }] },
      { type: "element", tag: "table" },
    ]);
  });

  it("drops active/resource subtrees while preserving safe unknown-tag text and inert links/images", () => {
    const nodes = parseSafeHtmlPreview('<script>alert(1)</script><template>template secret</template><div onclick="alert(2)">Visible</div><unknown>Safe child</unknown><img src="https://example.com/pixel" alt="pixel"><a href="javascript:alert(3)">Link</a><iframe src="https://example.com"></iframe>');
    expect(nodes).toMatchObject([
      { type: "element", tag: "div", children: [{ type: "text", value: "Visible" }] },
      { type: "text", value: "Safe child" },
      { type: "image", alt: "pixel" },
      { type: "element", tag: "a", href: "javascript:alert(3)", children: [{ type: "text", value: "Link" }] },
    ]);
    expect(JSON.stringify(nodes)).not.toContain("alert(1)");
    expect(JSON.stringify(nodes)).not.toContain("template secret");
    expect(JSON.stringify(nodes)).not.toContain("iframe");
  });

  it("allows explicit HTML5 media with a narrow attribute set and removes active attributes", () => {
    const nodes = parseSafeHtmlPreview('<video controls autoplay onclick="alert(1)" src="./demo.mp4" poster="./poster.png" width="640"><source src="./demo.webm" type="video/webm"><span>Video fallback</span></video><audio controls preload="metadata" src="./demo.mp3">Audio fallback</audio>');
    expect(nodes).toMatchObject([
      {
        type: "element",
        tag: "video",
        attributes: { controls: true, src: "./demo.mp4", poster: "./poster.png", width: "640" },
        children: [
          { type: "element", tag: "source", attributes: { src: "./demo.webm", type: "video/webm" } },
          { type: "element", tag: "span", children: [{ type: "text", value: "Video fallback" }] },
        ],
      },
      { type: "element", tag: "audio", attributes: { controls: true, preload: "metadata", src: "./demo.mp3" }, children: [{ type: "text", value: "Audio fallback" }] },
    ]);
    expect(JSON.stringify(nodes)).not.toContain("autoplay");
    expect(JSON.stringify(nodes)).not.toContain("onclick");
  });
});
