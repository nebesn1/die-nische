import { describe, expect, it } from "vitest";
import { createVfsTextFile } from "../../vfs/mutations";
import type { PublishedContentCatalogEntry } from "../../vfs/publishedContentCatalog";
import { resolveVfsPath } from "../../vfs/queries";
import { createVfsTestStateWithoutRepositoryContent } from "../../vfs/testFixtures";
import type { VfsState } from "../../vfs/types";
import { buildPublishedContentSearchDocuments } from "./publishedContentSearchDocuments";

const now = "2026-09-17T08:00:00.000Z";

const catalogEntry = (nodeId: string, title = nodeId): PublishedContentCatalogEntry => ({
  nodeId,
  canonicalPath: `/home/user/Documents/${nodeId}.md`,
  canonicalName: `${nodeId}.md`,
  title,
  aliases: [],
  publishedAt: now,
  tags: [],
});

const addText = (state: VfsState, name: string, text: string, mimeType = "text/markdown") => {
  const created = createVfsTextFile(state, "/home/user/Documents", name, text, { now, mimeType });
  if (!created.ok) throw new Error("Expected text fixture creation to succeed.");
  const node = resolveVfsPath(created.state, `/home/user/Documents/${name}`);
  if (!node.ok || node.value.kind !== "file") throw new Error("Text fixture missing.");
  return { state: created.state, node: node.value };
};

describe("published content search documents", () => {
  it("resolves only supplied catalog node IDs in catalog order without VFS discovery", () => {
    const published = addText(createVfsTestStateWithoutRepositoryContent(), "published.md", "Published body");
    const unpublished = addText(published.state, "unpublished.md", "UNPUBLISHEDSECRET");
    const documents = buildPublishedContentSearchDocuments([catalogEntry(published.node.id, "Published")], unpublished.state);

    expect(documents).toEqual([{ entry: catalogEntry(published.node.id, "Published"), bodyText: "Published body" }]);
    expect(JSON.stringify(documents)).not.toContain("UNPUBLISHEDSECRET");
  });

  it("keeps metadata-capable entries when their current text node is missing or asset-backed", () => {
    const text = addText(createVfsTestStateWithoutRepositoryContent(), "present.md", "Body");
    const missing = catalogEntry("missing", "Metadata survives");
    const assetState: VfsState = {
      ...text.state,
      nodesById: {
        ...text.state.nodesById,
        [text.node.id]: { ...text.node, content: { kind: "asset-url", url: "data:image/png;base64,AA==" } },
      },
    };

    expect(buildPublishedContentSearchDocuments([catalogEntry(text.node.id), missing], assetState)).toEqual([
      { entry: catalogEntry(text.node.id), bodyText: "" },
      { entry: missing, bodyText: "" },
    ]);
  });
});
