import { describe, expect, it } from "vitest";
import type { VfsTextFileNode } from "../../vfs/types";
import { getSafeVfsDocumentText } from "./safeVfsDocumentText";

const file = (name: string, text: string, mimeType = "text/plain"): VfsTextFileNode => ({
  id: `vfs-${name}`,
  name,
  parentId: "documents",
  kind: "file",
  encoding: "utf-8",
  mimeType,
  content: { kind: "text", text },
  size: text.length,
  createdAt: "2026-09-17T08:00:00.000Z",
  modifiedAt: "2026-09-17T08:00:00.000Z",
});

describe("safe VFS document text", () => {
  it("keeps raw plain text, including Unicode", () => {
    expect(getSafeVfsDocumentText(file("notes.txt", "Plain mechanical arm: 机械臂."))).toBe("Plain mechanical arm: 机械臂.");
  });

  it("uses rendered Markdown text while excluding raw link and image attributes", () => {
    const text = getSafeVfsDocumentText(file(
      "notes.md",
      "---\ntitle: Searchable Notes\npublication:\n  status: draft\n---\n# Robot Notes\n\n**Humanoid** `QWidget`\n\n```\nrobot.move()\n```\n\n[Visible Link](https://example.com/DESTINATIONSECRET) ![Image Alt Secret](resource-secret.png)\n\n<script>UNSAFESECRET</script>",
      "text/markdown",
    ));

    expect(text).toContain("Robot Notes");
    expect(text).toContain("Humanoid QWidget robot.move() Visible Link");
    expect(text).not.toContain("DESTINATIONSECRET");
    expect(text).not.toContain("resource-secret");
    expect(text).not.toContain("Image Alt Secret");
    expect(text).not.toContain("UNSAFESECRET");
    expect(text).not.toContain("Searchable Notes");
    expect(text).not.toContain("publication");
  });

  it("uses safe HTML visible text with entity decoding and structural boundaries", () => {
    const text = getSafeVfsDocumentText(file(
      "notes.html",
      "<h1>Robot Notes</h1><p>Fish &amp; Chips<br>Visible anchor <a href='https://example.com/URLSECRET'>Read more</a></p><script>SCRIPTSECRET</script><style>.STYLESECRET{}</style><template>TEMPLATESECRET</template><noscript>NOSCRIPTSECRET</noscript><div data-secret='ATTRSECRET' onclick='EVENTSECRET'>Visible body</div><!-- COMMENTSECRET --><div>alpha</div><div>beta</div><img src='RESOURCESECRET' alt='ALTSECRET'>",
      "text/html",
    ));

    expect(text).toBe("Robot Notes Fish & Chips Visible anchor Read more Visible body alpha beta");
    ["URLSECRET", "SCRIPTSECRET", "STYLESECRET", "TEMPLATESECRET", "NOSCRIPTSECRET", "ATTRSECRET", "EVENTSECRET", "COMMENTSECRET", "RESOURCESECRET", "ALTSECRET", "alphabeta", "amp"].forEach((value) => expect(text).not.toContain(value));
  });

  it("uses the same Markdown and HTML previewer rules for .markdown and .htm", () => {
    expect(getSafeVfsDocumentText(file("long.markdown", "# Heading", "text/markdown"))).toBe("Heading");
    expect(getSafeVfsDocumentText(file("legacy.htm", "<p>Safe HTML</p>", "text/html"))).toBe("Safe HTML");
  });
});
