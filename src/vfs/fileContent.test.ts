import { describe, expect, it } from "vitest";
import { createVfsAssetUrlFileContent, createVfsTextFileContent, getVfsFileAssetUrl, getVfsTextFileContent, isVfsAssetUrlFile, isVfsTextFile } from "./fileContent";
import { createInitialVfsState } from "./initialState";
import { appendVfsTextFile, copyVfsNode, moveVfsNode, moveVfsNodeToTrash, renameVfsNode, restoreVfsNodeFromTrash, writeVfsTextFile } from "./mutations";
import { getVfsPathForNode, readVfsTextFile, resolveVfsPath } from "./queries";
import type { VfsFileNode, VfsState } from "./types";

const now = "2026-09-12T00:00:00.000Z";

const createAssetFixture = (): VfsState => {
  const initial = createInitialVfsState();
  const documents = initial.nodesById[initial.specialLocations.documents];
  if (!documents || documents.kind !== "directory") throw new Error("Documents fixture missing");
  const asset: VfsFileNode = {
    id: "vfs-asset-photo",
    name: "Photo.png",
    parentId: documents.id,
    kind: "file",
    encoding: "utf-8",
    mimeType: "image/png",
    content: createVfsAssetUrlFileContent("/assets/photo-abc.png"),
    size: 4096,
    createdAt: now,
    modifiedAt: now,
  };

  return {
    ...initial,
    nodesById: {
      ...initial.nodesById,
      [documents.id]: { ...documents, childIds: [...documents.childIds, asset.id] },
      [asset.id]: asset,
    },
  };
};

const expectOk = <T,>(result: { readonly ok: true; readonly value: T } | { readonly ok: false }): T => {
  if (!result.ok) throw new Error("Expected VFS operation to succeed");
  return result.value;
};

const getRepositoryImage = (state: VfsState): VfsFileNode => {
  const image = Object.values(state.nodesById).find((node): node is VfsFileNode =>
    node.kind === "file" && node.parentId === state.specialLocations.pictures && node.content.kind === "asset-url",
  );
  if (!image) throw new Error("Repository image fixture missing");
  return image;
};

const createAudioFixture = (): VfsState => {
  const state = createAssetFixture();
  const asset = state.nodesById["vfs-asset-photo"];
  if (!asset || asset.kind !== "file") throw new Error("Audio fixture missing");

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [asset.id]: {
        ...asset,
        name: "Song.mp3",
        mimeType: "audio/mpeg",
        content: createVfsAssetUrlFileContent("/assets/song-abc.mp3"),
      },
    },
  };
};

const createVideoFixture = (): VfsState => {
  const state = createAssetFixture();
  const asset = state.nodesById["vfs-asset-photo"];
  if (!asset || asset.kind !== "file") throw new Error("Video fixture missing");

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [asset.id]: {
        ...asset,
        name: "Clip.webm",
        mimeType: "video/webm",
        content: createVfsAssetUrlFileContent("/assets/clip-abc.webm"),
      },
    },
  };
};

describe("VFS typed file content", () => {
  it("distinguishes text from asset URLs without treating an asset URL as text", () => {
    const state = createAssetFixture();
    const text = expectOk(resolveVfsPath(state, "/home/user/Documents/Welcome.md"));
    const asset = state.nodesById["vfs-asset-photo"];

    if (!asset || asset.kind !== "file" || text.kind !== "file") throw new Error("File fixtures missing");

    expect(createVfsTextFileContent("hello")).toEqual({ kind: "text", text: "hello" });
    expect(isVfsTextFile(text)).toBe(true);
    expect(getVfsTextFileContent(text)).toContain("# Welcome to die Nische");
    expect(isVfsAssetUrlFile(asset)).toBe(true);
    expect(getVfsFileAssetUrl(asset)).toBe("/assets/photo-abc.png");
    expect(getVfsTextFileContent(asset)).toBeNull();
  });

  it("rejects text read and write mutations for asset-backed files without changing the state", () => {
    const state = createAssetFixture();
    const read = readVfsTextFile(state, "/home/user/Documents/Photo.png");
    const written = writeVfsTextFile(state, "/home/user/Documents/Photo.png", "replacement", { now });
    const appended = appendVfsTextFile(state, "/home/user/Documents/Photo.png", "replacement", { now });

    expect(read).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_FILE_CONTENT" } });
    expect(written).toMatchObject({ ok: false, state, error: { code: "UNSUPPORTED_FILE_CONTENT" } });
    expect(appended).toMatchObject({ ok: false, state, error: { code: "UNSUPPORTED_FILE_CONTENT" } });
  });

  it("preserves asset URL, MIME type, binary size, and identities through copy, rename, and move", () => {
    const copied = copyVfsNode(createAssetFixture(), "/home/user/Documents/Photo.png", "/home/user/Downloads", { now });
    if (!copied.ok) throw new Error("Asset copy failed");
    const renamed = renameVfsNode(copied.state, "/home/user/Downloads/Photo.png", "Copy.png", { now });
    if (!renamed.ok) throw new Error("Asset rename failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Documents/Photo.png", "/home/user/Downloads", { now, newName: "Moved.png" });
    if (!moved.ok) throw new Error("Asset move failed");

    const copiedAsset = expectOk(resolveVfsPath(moved.state, "/home/user/Downloads/Copy.png"));
    const movedAsset = expectOk(resolveVfsPath(moved.state, "/home/user/Downloads/Moved.png"));

    expect(copiedAsset).toMatchObject({ mimeType: "image/png", size: 4096, content: { kind: "asset-url", url: "/assets/photo-abc.png" } });
    expect(movedAsset).toMatchObject({ id: "vfs-asset-photo", mimeType: "image/png", size: 4096, content: { kind: "asset-url", url: "/assets/photo-abc.png" } });
    expect(copiedAsset.id).not.toBe(movedAsset.id);
  });

  it("preserves an asset reference through Trash and Restore without loading its bytes", () => {
    const trashed = moveVfsNodeToTrash(createAssetFixture(), "/home/user/Documents/Photo.png", { now });
    if (!trashed.ok) throw new Error("Asset trash failed");
    const restored = restoreVfsNodeFromTrash(trashed.state, trashed.value.id, { now: "2026-09-12T00:01:00.000Z" });
    if (!restored.ok) throw new Error("Asset restore failed");

    expect(expectOk(resolveVfsPath(restored.state, "/home/user/Documents/Photo.png"))).toMatchObject({
      id: "vfs-asset-photo",
      content: { kind: "asset-url", url: "/assets/photo-abc.png" },
      size: 4096,
    });
  });

  it("keeps the repository-generated PNG asset URL across runtime file operations while a new initial state restores its baseline path", () => {
    const initial = createInitialVfsState();
    const source = getRepositoryImage(initial);
    const sourcePath = expectOk(getVfsPathForNode(initial, source.id));
    const copied = copyVfsNode(initial, sourcePath, "/home/user/Downloads", { now, newName: "Copy.png" });
    if (!copied.ok) throw new Error("Repository PNG copy failed");
    const renamed = renameVfsNode(copied.state, sourcePath, "Renamed.png", { now });
    if (!renamed.ok) throw new Error("Repository PNG rename failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Pictures/Renamed.png", "/home/user/Documents", { now });
    if (!moved.ok) throw new Error("Repository PNG move failed");
    const trashed = moveVfsNodeToTrash(moved.state, "/home/user/Documents/Renamed.png", { now });
    if (!trashed.ok) throw new Error("Repository PNG trash failed");
    const restored = restoreVfsNodeFromTrash(trashed.state, trashed.value.id, { now: "2026-09-12T00:01:00.000Z" });
    if (!restored.ok) throw new Error("Repository PNG restore failed");

    expect(expectOk(resolveVfsPath(restored.state, "/home/user/Documents/Renamed.png"))).toMatchObject({
      id: source.id,
      mimeType: "image/png",
      size: source.size,
      content: source.content,
    });
    expect(expectOk(resolveVfsPath(restored.state, "/home/user/Downloads/Copy.png"))).toMatchObject({
      id: expect.stringMatching(/^vfs-node-/),
      mimeType: "image/png",
      size: source.size,
      content: source.content,
    });
    expect(getRepositoryImage(createInitialVfsState())).toMatchObject({ id: source.id, content: source.content });
  });

  it("keeps an audio asset typed and lossless through text rejection and runtime file operations", () => {
    const state = createAudioFixture();
    const read = readVfsTextFile(state, "/home/user/Documents/Song.mp3");
    expect(read).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_FILE_CONTENT" } });

    const copied = copyVfsNode(state, "/home/user/Documents/Song.mp3", "/home/user/Downloads", { now });
    if (!copied.ok) throw new Error("Audio copy failed");
    const moved = moveVfsNode(copied.state, "/home/user/Downloads/Song.mp3", "/home/user/Music", { now, newName: "Moved.mp3" });
    if (!moved.ok) throw new Error("Audio move failed");
    const trashed = moveVfsNodeToTrash(moved.state, "/home/user/Music/Moved.mp3", { now });
    if (!trashed.ok) throw new Error("Audio trash failed");
    const restored = restoreVfsNodeFromTrash(trashed.state, trashed.value.id, { now });
    if (!restored.ok) throw new Error("Audio restore failed");

    expect(expectOk(resolveVfsPath(restored.state, "/home/user/Music/Moved.mp3"))).toMatchObject({
      id: "vfs-node-0010",
      mimeType: "audio/mpeg",
      size: 4096,
      content: { kind: "asset-url", url: "/assets/song-abc.mp3" },
    });
  });

  it("keeps a video asset typed and lossless through text rejection and runtime file operations", () => {
    const state = createVideoFixture();
    const read = readVfsTextFile(state, "/home/user/Documents/Clip.webm");
    const written = writeVfsTextFile(state, "/home/user/Documents/Clip.webm", "replacement", { now });
    const appended = appendVfsTextFile(state, "/home/user/Documents/Clip.webm", "replacement", { now });

    expect(read).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_FILE_CONTENT" } });
    expect(written).toMatchObject({ ok: false, state, error: { code: "UNSUPPORTED_FILE_CONTENT" } });
    expect(appended).toMatchObject({ ok: false, state, error: { code: "UNSUPPORTED_FILE_CONTENT" } });

    const copied = copyVfsNode(state, "/home/user/Documents/Clip.webm", "/home/user/Downloads", { now });
    if (!copied.ok) throw new Error("Video copy failed");
    const renamed = renameVfsNode(copied.state, "/home/user/Downloads/Clip.webm", "Renamed.webm", { now });
    if (!renamed.ok) throw new Error("Video rename failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Downloads/Renamed.webm", "/home/user/Music", { now });
    if (!moved.ok) throw new Error("Video move failed");
    const trashed = moveVfsNodeToTrash(moved.state, "/home/user/Music/Renamed.webm", { now });
    if (!trashed.ok) throw new Error("Video trash failed");
    const restored = restoreVfsNodeFromTrash(trashed.state, trashed.value.id, { now });
    if (!restored.ok) throw new Error("Video restore failed");

    expect(expectOk(resolveVfsPath(restored.state, "/home/user/Music/Renamed.webm"))).toMatchObject({
      id: expect.stringMatching(/^vfs-node-/),
      mimeType: "video/webm",
      size: 4096,
      content: { kind: "asset-url", url: "/assets/clip-abc.webm" },
    });
  });
});
