import { describe, expect, it } from "vitest";
import { createInitialVfsState, INITIAL_VFS_TIMESTAMP } from "./initialState";
import { validateVfsState } from "./invariants";
import { copyVfsNode, createVfsDirectory, createVfsTextFile, moveVfsNode, moveVfsNodeToTrash, renameVfsNode, restoreVfsNodeFromTrash, writeVfsTextFile } from "./mutations";
import { getVfsNodeDisplayName } from "./presentation";
import { getVfsPublicationTitle, isVfsFileDraft, isVfsFilePublished } from "./publication";
import { getVfsPathForNode, listVfsDirectory, readVfsTextFile, resolveVfsPath } from "./queries";
import { mergeRepositoryContentManifest } from "./repositoryContentSeed";
import type { GeneratedVfsContentEntry, GeneratedVfsContentManifest } from "./repositoryContentManifest";

const now = "2026-09-12T00:00:00.000Z";

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected VFS result to succeed.");
  }

  return result.value;
};

const directory = (virtualPath: string, id: string): Extract<GeneratedVfsContentEntry, { readonly kind: "directory" }> => ({
  kind: "directory",
  id,
  virtualPath,
  parentVirtualPath: virtualPath === "/home/user" ? null : virtualPath.slice(0, virtualPath.lastIndexOf("/")) || "/",
  name: virtualPath.slice(virtualPath.lastIndexOf("/") + 1),
  created: INITIAL_VFS_TIMESTAMP,
  modified: INITIAL_VFS_TIMESTAMP,
});

const textFile = (virtualPath: string, id: string, text: string): Extract<GeneratedVfsContentEntry, { readonly kind: "file" }> => ({
  kind: "file",
  id,
  virtualPath,
  parentVirtualPath: virtualPath.slice(0, virtualPath.lastIndexOf("/")),
  name: virtualPath.slice(virtualPath.lastIndexOf("/") + 1),
  mimeType: "text/markdown",
  size: new TextEncoder().encode(text).length,
  created: INITIAL_VFS_TIMESTAMP,
  modified: INITIAL_VFS_TIMESTAMP,
  source: { kind: "text", text },
});

const assetFile = (virtualPath: string, id: string, mimeType: string, size: number): Extract<GeneratedVfsContentEntry, { readonly kind: "file" }> => ({
  kind: "file",
  id,
  virtualPath,
  parentVirtualPath: virtualPath.slice(0, virtualPath.lastIndexOf("/")),
  name: virtualPath.slice(virtualPath.lastIndexOf("/") + 1),
  mimeType,
  size,
  created: INITIAL_VFS_TIMESTAMP,
  modified: INITIAL_VFS_TIMESTAMP,
  source: { kind: "asset-url", url: `content/home/user${virtualPath.slice("/home/user".length)}` },
});

const manifest = (...entries: GeneratedVfsContentEntry[]): GeneratedVfsContentManifest => ({ entries });

describe("repository content seed adapter", () => {
  it("reuses every platform mount, appends generated children deterministically, and preserves initial state authority", () => {
    const initial = createInitialVfsState();
    const initialDocumentNames = expectOk(listVfsDirectory(initial, "/home/user/Documents")).map((node) => node.name);
    const content = manifest(
      directory("/home/user", "vfs-content-home"),
      directory("/home/user/Desktop", "vfs-content-desktop"),
      directory("/home/user/Documents", "vfs-content-documents"),
      directory("/home/user/Downloads", "vfs-content-downloads"),
      directory("/home/user/Music", "vfs-content-music"),
      directory("/home/user/Pictures", "vfs-content-pictures"),
      directory("/home/user/Videos", "vfs-content-videos"),
      assetFile("/home/user/Music/Song.mp3", "vfs-content-song", "audio/mpeg", 4),
      assetFile("/home/user/Videos/Sample.mp4", "vfs-content-video", "video/mp4", 12),
      assetFile("/home/user/Documents/Clip.webm", "vfs-content-clip", "video/webm", 9),
      directory("/home/user/Documents/Imported", "vfs-content-imported"),
      textFile("/home/user/Documents/Imported/Readme.md", "vfs-content-readme", "# 你好"),
    );

    const merged = mergeRepositoryContentManifest(initial, content);

    expect(expectOk(resolveVfsPath(merged, "/home/user")).id).toBe(initial.specialLocations.home);
    expect(expectOk(resolveVfsPath(merged, "/home/user/Desktop")).id).toBe(initial.specialLocations.desktopDirectory);
    expect(expectOk(resolveVfsPath(merged, "/home/user/Documents")).id).toBe(initial.specialLocations.documents);
    expect(expectOk(listVfsDirectory(merged, "/home/user/Documents")).map((node) => node.name)).toEqual([
      ...initialDocumentNames,
      "Clip.webm",
      "Imported",
    ]);
    expect(expectOk(readVfsTextFile(merged, "/home/user/Documents/Imported/Readme.md"))).toMatchObject({
      id: "vfs-content-readme",
      content: { kind: "text", text: "# 你好" },
      size: 8,
      mimeType: "text/markdown",
    });
    expect(expectOk(resolveVfsPath(merged, "/home/user/Music"))).toMatchObject({ id: initial.specialLocations.music });
    expect(expectOk(resolveVfsPath(merged, "/home/user/Videos"))).toMatchObject({ id: initial.specialLocations.videos, kind: "directory" });
    expect(expectOk(resolveVfsPath(merged, "/home/user/Videos/Sample.mp4"))).toMatchObject({
      id: "vfs-content-video",
      parentId: initial.specialLocations.videos,
      mimeType: "video/mp4",
      size: 12,
      content: { kind: "asset-url", url: "content/home/user/Videos/Sample.mp4" },
    });
    expect(expectOk(resolveVfsPath(merged, "/home/user/Music/Song.mp3"))).toMatchObject({
      id: "vfs-content-song",
      mimeType: "audio/mpeg",
      size: 4,
      content: { kind: "asset-url", url: "content/home/user/Music/Song.mp3" },
    });
    expect(expectOk(resolveVfsPath(merged, "/home/user/Documents/Clip.webm"))).toMatchObject({
      id: "vfs-content-clip",
      mimeType: "video/webm",
      size: 9,
      content: { kind: "asset-url", url: "content/home/user/Documents/Clip.webm" },
    });
    expect(merged.specialLocations).toBe(initial.specialLocations);
    expect(merged.revision).toBe(initial.revision);
    expect(merged.nextNodeSequence).toBe(initial.nextNodeSequence);
    expect(validateVfsState(merged)).toEqual([]);
  });

  it("merges repository Videos into the existing mount without duplicating the standard directory", () => {
    const initial = createInitialVfsState();
    const merged = mergeRepositoryContentManifest(initial, manifest(
      directory("/home/user", "vfs-content-home"),
      directory("/home/user/Videos", "vfs-content-videos"),
      assetFile("/home/user/Videos/Clip.webm", "vfs-content-clip", "video/webm", 8),
    ));
    const home = expectOk(listVfsDirectory(merged, "/home/user"));

    expect(home.filter((node) => node.name === "Videos")).toHaveLength(1);
    expect(expectOk(resolveVfsPath(merged, "/home/user/Videos"))).toMatchObject({
      id: initial.specialLocations.videos,
      childIds: ["vfs-content-clip"],
    });
    expect(merged.nodesById["vfs-content-clip"]).toMatchObject({ parentId: initial.specialLocations.videos });
  });

  it("rejects duplicate generated identity, conflicting hardcoded paths, missing parents, and non-directory parents", () => {
    const initial = createInitialVfsState();

    expect(() =>
      mergeRepositoryContentManifest(initial, manifest(textFile("/home/user/Documents/Welcome.md", "vfs-content-conflict", "replacement"))),
    ).toThrow("conflicts with existing platform node");
    expect(() =>
      mergeRepositoryContentManifest(initial, manifest(textFile("/home/user/Documents/A.txt", "vfs-content-duplicate", "a"), textFile("/home/user/Documents/B.txt", "vfs-content-duplicate", "b"))),
    ).toThrow("Duplicate generated node id");
    expect(() =>
      mergeRepositoryContentManifest(initial, manifest(textFile("/home/user/Documents/Missing/A.txt", "vfs-content-missing", "a"))),
    ).toThrow("no existing directory parent");
    expect(() =>
      mergeRepositoryContentManifest(initial, manifest(textFile("/home/user/Documents/Parent.txt", "vfs-content-parent", "a"), textFile("/home/user/Documents/Parent.txt/Child.txt", "vfs-content-child", "b"))),
    ).toThrow("no existing directory parent");
  });

  it("keeps generated identities through runtime rename and move while runtime node IDs remain collision-free", () => {
    const initial = createInitialVfsState();
    const merged = mergeRepositoryContentManifest(
      initial,
      manifest(
        directory("/home/user", "vfs-content-home"),
        directory("/home/user/Documents", "vfs-content-documents"),
        textFile("/home/user/Documents/Generated.txt", "vfs-content-generated", "generated"),
      ),
    );
    const renamed = renameVfsNode(merged, "/home/user/Documents/Generated.txt", "Renamed.txt", { now });

    expect(renamed.ok).toBe(true);

    if (!renamed.ok) {
      throw new Error("Generated node rename failed.");
    }

    const moved = moveVfsNode(renamed.state, "/home/user/Documents/Renamed.txt", "/home/user/Downloads", { now });
    const created = createVfsDirectory(moved.ok ? moved.state : renamed.state, "/home/user/Documents", "Runtime", { now });
    const createdText = created.ok
      ? createVfsTextFile(created.state, "/home/user/Documents/Runtime", "Runtime.txt", "runtime", { now })
      : created;
    const copied = createdText.ok
      ? copyVfsNode(createdText.state, "/home/user/Documents/Runtime/Runtime.txt", "/home/user/Downloads", { now })
      : createdText;

    expect(moved.ok).toBe(true);
    expect(moved.ok ? moved.value.id : null).toBe("vfs-content-generated");
    expect(moved.ok ? expectOk(getVfsPathForNode(moved.state, "vfs-content-generated")) : null).toBe("/home/user/Downloads/Renamed.txt");
    expect(created.ok ? created.value.id : null).toBe("vfs-node-0010");
    expect(createdText.ok ? createdText.value.id : null).toBe("vfs-node-0011");
    expect(copied.ok ? copied.value.id : null).toBe("vfs-node-0012");
    expect(copied.ok ? validateVfsState(copied.state) : []).toEqual([]);
  });

  it("keeps displayName presentation-only through canonical resolution, runtime rename, move, copy, Trash, and Restore", () => {
    const initial = createInitialVfsState();
    const generated = { ...textFile("/home/user/Documents/article.md", "vfs-content-article", "# Article"), displayName: "My Article" };
    const merged = mergeRepositoryContentManifest(initial, manifest(directory("/home/user", "vfs-content-home"), directory("/home/user/Documents", "vfs-content-documents"), generated));
    const original = expectOk(resolveVfsPath(merged, "/home/user/Documents/article.md"));
    expect(original).toMatchObject({ name: "article.md", displayName: "My Article" });
    expect(getVfsNodeDisplayName(original)).toBe("My Article");
    expect(resolveVfsPath(merged, "/home/user/Documents/My Article")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

    const renamed = renameVfsNode(merged, "/home/user/Documents/article.md", "post.md", { now });
    if (!renamed.ok) throw new Error("rename fixture failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Documents/post.md", "/home/user/Downloads", { now });
    if (!moved.ok) throw new Error("move fixture failed");
    const copied = copyVfsNode(moved.state, "/home/user/Downloads/post.md", "/home/user/Documents", { now, newName: "copy.md" });
    if (!copied.ok) throw new Error("copy fixture failed");
    const copy = expectOk(resolveVfsPath(copied.state, "/home/user/Documents/copy.md"));
    expect(copy).toMatchObject({ displayName: "My Article" });
    expect(copy.id).not.toBe(original.id);

    const trashed = moveVfsNodeToTrash(copied.state, "/home/user/Downloads/post.md", { now });
    if (!trashed.ok) throw new Error("trash fixture failed");
    const restored = restoreVfsNodeFromTrash(trashed.state, original.id, { now });
    if (!restored.ok) throw new Error("restore fixture failed");
    expect(restored.value).toMatchObject({ name: "post.md", displayName: "My Article" });
  });

  it("keeps publication on the same file identity but clears it for copied identities", () => {
    const initial = createInitialVfsState();
    const generated = {
      ...textFile("/home/user/Documents/article.md", "vfs-content-article", "# Article"),
      displayName: "My Article",
      publication: { status: "published" as const, publishedAt: "2026-09-10T08:00:00.000Z", summary: "Summary", tags: ["KDE 3", "Web"] },
    };
    const merged = mergeRepositoryContentManifest(initial, manifest(directory("/home/user", "vfs-content-home"), directory("/home/user/Documents", "vfs-content-documents"), generated));
    const original = expectOk(resolveVfsPath(merged, "/home/user/Documents/article.md"));
    if (original.kind !== "file") throw new Error("Expected publication fixture file");
    expect(isVfsFilePublished(original)).toBe(true);
    expect(isVfsFileDraft(original)).toBe(false);
    expect(getVfsPublicationTitle(original)).toBe("My Article");
    const unnamed = { ...original, displayName: undefined };
    expect(getVfsPublicationTitle(unnamed)).toBe("article.md");

    const renamed = renameVfsNode(merged, "/home/user/Documents/article.md", "post.md", { now });
    if (!renamed.ok) throw new Error("rename fixture failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Documents/post.md", "/home/user/Downloads", { now });
    if (!moved.ok) throw new Error("move fixture failed");
    const edited = writeVfsTextFile(moved.state, "/home/user/Downloads/post.md", "# Updated", { now: "2026-09-13T00:00:00.000Z" });
    if (!edited.ok) throw new Error("write fixture failed");
    expect(edited.value.publication).toEqual(original.publication);
    const copied = expectOk(copyVfsNode(edited.state, "/home/user/Downloads/post.md", "/home/user/Documents", { now, newName: "copy.md" }));
    expect(copied.kind === "file" ? copied.publication : undefined).toBeUndefined();

    const trashed = moveVfsNodeToTrash(edited.state, "/home/user/Downloads/post.md", { now });
    if (!trashed.ok) throw new Error("trash fixture failed");
    const restored = expectOk(restoreVfsNodeFromTrash(trashed.state, trashed.value.id, { now }));
    expect(restored.kind === "file" ? restored.publication : undefined).toEqual(original.publication);
  });

  it("merges asset-backed files without converting their source URL or binary size into text", () => {
    const merged = mergeRepositoryContentManifest(
      createInitialVfsState(),
      manifest(assetFile("/home/user/Pictures/Photo.PNG", "vfs-content-photo", "image/png", 4096)),
    );
    const photo = expectOk(resolveVfsPath(merged, "/home/user/Pictures/Photo.PNG"));

    expect(photo).toMatchObject({
      id: "vfs-content-photo",
      kind: "file",
      mimeType: "image/png",
      size: 4096,
      content: { kind: "asset-url", url: "content/home/user/Pictures/Photo.PNG" },
    });
    expect(validateVfsState(merged)).toEqual([]);
  });
});
