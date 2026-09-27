import { describe, expect, it } from "vitest";
import { copyVfsNode, createVfsTextFile, moveVfsNode, moveVfsNodeToTrash, renameVfsNode, restoreVfsNodeFromTrash } from "./mutations";
import { buildPublishedContentCatalog } from "./publishedContentCatalog";
import { resolveVfsPath } from "./queries";
import type { VfsPublicationMetadata, VfsState } from "./types";
import { createVfsTestStateWithoutRepositoryContent } from "./testFixtures";

const now = "2026-09-14T00:00:00.000Z";

const expectMutation = <T,>(result: { readonly ok: true; readonly value: T; readonly state: VfsState } | { readonly ok: false }): { readonly value: T; readonly state: VfsState } => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed.");
  return result;
};

const publish = (state: VfsState, path: string, publication: VfsPublicationMetadata): VfsState => {
  const resolved = resolveVfsPath(state, path);
  if (!resolved.ok || resolved.value.kind !== "file") throw new Error(`Missing text fixture '${path}'.`);

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [resolved.value.id]: { ...resolved.value, publication },
    },
  };
};

const createText = (state: VfsState, directory: string, name: string): VfsState =>
  expectMutation(createVfsTextFile(state, directory, name, "text", { now, mimeType: "text/markdown" })).state;

describe("published content catalog", () => {
  it("is empty without published live text files and excludes drafts and unmanaged files", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "draft.md");
    state = createText(state, "/home/user/Documents", "plain.md");
    state = publish(state, "/home/user/Documents/draft.md", { status: "draft", summary: "Draft" });

    expect(buildPublishedContentCatalog(state)).toEqual([]);
  });

  it("projects published identity, canonical naming, title, summary, and an immutable tag copy", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "article.md");
    state = publish(state, "/home/user/Documents/article.md", {
      status: "published",
      slug: "my-article",
      publishedAt: "2026-09-12T08:00:00.000Z",
      summary: "Article summary",
      tags: ["Qt", "Godot", "机器人"],
    });
    const source = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!source.ok || source.value.kind !== "file") throw new Error("Published fixture missing");
    state = { ...state, nodesById: { ...state.nodesById, [source.value.id]: { ...source.value, displayName: "My Article" } } };

    const catalog = buildPublishedContentCatalog(state);
    expect(catalog).toEqual([{
      nodeId: source.value.id,
      canonicalPath: "/home/user/Documents/article.md",
      canonicalName: "article.md",
      title: "My Article",
      slug: "my-article",
      aliases: [],
      publishedAt: "2026-09-12T08:00:00.000Z",
      summary: "Article summary",
      tags: ["Qt", "Godot", "机器人"],
    }]);
    (catalog[0]!.tags as string[]).push("Mutated projection");
    expect(source.value.publication?.tags).toEqual(["Qt", "Godot", "机器人"]);
  });

  it("projects v6 aliases in authored order without exposing source publication arrays", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "article.md");
    state = publish(state, "/home/user/Documents/article.md", {
      status: "published",
      slug: "current-name",
      aliases: ["old-name", "original-name"],
      publishedAt: "2026-09-12T08:00:00.000Z",
    });
    const source = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!source.ok || source.value.kind !== "file") throw new Error("Published fixture missing");

    const catalog = buildPublishedContentCatalog(state);
    expect(catalog[0]?.aliases).toEqual(["old-name", "original-name"]);
    (catalog[0]!.aliases as string[]).push("mutated-projection");
    expect(source.value.publication?.aliases).toEqual(["old-name", "original-name"]);
    expect(buildPublishedContentCatalog(state)[0]?.aliases).toEqual(["old-name", "original-name"]);
  });

  it("projects an authored slug without changing v4 catalog eligibility or ordering", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "v4.md");
    state = createText(state, "/home/user/Documents", "v5.md");
    state = publish(state, "/home/user/Documents/v4.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    state = publish(state, "/home/user/Documents/v5.md", { status: "published", slug: "v5-article", publishedAt: "2026-09-13T08:00:00.000Z" });

    expect(buildPublishedContentCatalog(state).map((entry) => [entry.canonicalName, entry.slug])).toEqual([
      ["v5.md", "v5-article"],
      ["v4.md", undefined],
    ]);
  });

  it("uses an empty tag array and canonical filename title fallback", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "article.md");
    state = publish(state, "/home/user/Documents/article.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });

    expect(buildPublishedContentCatalog(state)).toMatchObject([{ canonicalName: "article.md", title: "article.md", tags: [] }]);
  });

  it("sorts publication time descending, then canonical path and node identity without title, modified, or sibling-order semantics", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "z.md");
    state = createText(state, "/home/user/Documents", "a.md");
    state = createText(state, "/home/user/Documents", "new.md");
    state = publish(state, "/home/user/Documents/z.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    state = publish(state, "/home/user/Documents/a.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    state = publish(state, "/home/user/Documents/new.md", { status: "published", publishedAt: "2026-09-13T08:00:00.000Z" });
    const a = resolveVfsPath(state, "/home/user/Documents/a.md");
    const z = resolveVfsPath(state, "/home/user/Documents/z.md");
    if (!a.ok || !z.ok || a.value.kind !== "file" || z.value.kind !== "file") throw new Error("Sort fixtures missing");
    state = {
      ...state,
      nodesById: {
        ...state.nodesById,
        [a.value.id]: { ...a.value, displayName: "Zebra", modifiedAt: "2026-09-14T00:00:00.000Z" },
        [z.value.id]: { ...z.value, displayName: "Alpha", modifiedAt: "2026-01-01T00:00:00.000Z" },
      },
    };

    expect(buildPublishedContentCatalog(state).map((entry) => entry.canonicalName)).toEqual(["new.md", "a.md", "z.md"]);
  });

  it("tracks rename and ordinary home moves through current canonical paths", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "article.md");
    state = publish(state, "/home/user/Documents/article.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    const renamed = expectMutation(renameVfsNode(state, "/home/user/Documents/article.md", "post.md", { now }));
    const moved = expectMutation(moveVfsNode(renamed.state, "/home/user/Documents/post.md", "/home/user/Desktop", { now }));

    expect(buildPublishedContentCatalog(moved.state)).toMatchObject([{ canonicalName: "post.md", canonicalPath: "/home/user/Desktop/post.md", title: "post.md" }]);
  });

  it("excludes published Trash descendants while preserving their metadata and restores them to the catalog", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "article.md");
    const publication = { status: "published" as const, publishedAt: "2026-09-12T08:00:00.000Z" };
    state = publish(state, "/home/user/Documents/article.md", publication);
    const trashed = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/article.md", { now }));
    expect(buildPublishedContentCatalog(trashed.state)).toEqual([]);
    expect(trashed.value.kind === "file" ? trashed.value.publication : undefined).toEqual(publication);
    const restored = expectMutation(restoreVfsNodeFromTrash(trashed.state, trashed.value.id, { now }));
    expect(buildPublishedContentCatalog(restored.state)).toMatchObject([{ nodeId: restored.value.id, publishedAt: publication.publishedAt }]);
  });

  it("excludes copied identities because VFS copy clears publication", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "article.md");
    state = publish(state, "/home/user/Documents/article.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    const copied = expectMutation(copyVfsNode(state, "/home/user/Documents/article.md", "/home/user/Desktop", { now }));

    expect(buildPublishedContentCatalog(copied.state).map((entry) => entry.canonicalName)).toEqual(["article.md"]);
    expect(copied.value.kind === "file" ? copied.value.publication : undefined).toBeUndefined();
  });

  it("reflects publication metadata transitions without storing a catalog", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "article.md");
    state = publish(state, "/home/user/Documents/article.md", { status: "draft" });
    expect(buildPublishedContentCatalog(state)).toEqual([]);
    state = publish(state, "/home/user/Documents/article.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z", summary: "One", tags: ["Qt"] });
    expect(buildPublishedContentCatalog(state)).toMatchObject([{ summary: "One", tags: ["Qt"] }]);
    state = publish(state, "/home/user/Documents/article.md", { status: "published", publishedAt: "2026-09-13T08:00:00.000Z", summary: "Two", tags: ["Qt", "React"] });
    expect(buildPublishedContentCatalog(state)).toMatchObject([{ publishedAt: "2026-09-13T08:00:00.000Z", summary: "Two", tags: ["Qt", "React"] }]);
    state = publish(state, "/home/user/Documents/article.md", { status: "draft" });
    expect(buildPublishedContentCatalog(state)).toEqual([]);
  });

  it("excludes orphan and non-home special-scope nodes even when they carry publication metadata", () => {
    let state = createVfsTestStateWithoutRepositoryContent();
    state = createText(state, "/home/user/Documents", "article.md");
    state = publish(state, "/home/user/Documents/article.md", { status: "published", publishedAt: "2026-09-12T08:00:00.000Z" });
    const article = resolveVfsPath(state, "/home/user/Documents/article.md");
    if (!article.ok || article.value.kind !== "file") throw new Error("Scope fixture missing");
    const orphan = { ...article.value, id: "vfs-orphan-published", parentId: state.specialLocations.documents };
    const documents = state.nodesById[state.specialLocations.documents];
    const cdrom = state.nodesById[state.specialLocations.cdrom];
    if (!documents || documents.kind !== "directory" || !cdrom || cdrom.kind !== "directory") throw new Error("Scope fixture missing");
    const cdromFile = { ...article.value, id: "vfs-cdrom-published", parentId: cdrom.id, name: "cdrom.md" };
    state = {
      ...state,
      nodesById: {
        ...state.nodesById,
        [orphan.id]: orphan,
        [documents.id]: { ...documents, childIds: [...documents.childIds, article.value.id] },
        [cdrom.id]: { ...cdrom, childIds: [...cdrom.childIds, cdromFile.id] },
        [cdromFile.id]: cdromFile,
      },
    };

    expect(buildPublishedContentCatalog(state).map((entry) => entry.nodeId)).toEqual([article.value.id]);
  });
});
