import { describe, expect, it } from "vitest";
import { createInitialVfsState, PROJECT_EPOCH_TIMESTAMP } from "./initialState";
import { validateVfsState } from "./invariants";
import { copyVfsNode, deleteVfsNodePermanently, moveVfsNode, moveVfsNodeToTrash, renameVfsNode, restoreVfsNodeFromTrash, writeVfsTextFile } from "./mutations";
import { getVfsPathForNode, listVfsDirectory, readVfsTextFile, resolveVfsPath } from "./queries";
import { VFS_TRASH_FILES_PATH } from "./trashPaths";
import { isProtectedVfsNode } from "./tree";

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected ok result");
  }

  return result.value;
};

describe("initial VFS state", () => {
  it("returns independent state objects and node references", () => {
    const first = createInitialVfsState();
    const second = createInitialVfsState();

    expect(first).not.toBe(second);
    expect(first.nodesById).not.toBe(second.nodesById);
    expect(first.trashEntriesByNodeId).not.toBe(second.trashEntriesByNodeId);
    expect(first.nodesById[first.rootId]).not.toBe(second.nodesById[second.rootId]);
  });

  it("creates the expected root, tree, ids, revision, and special locations", () => {
    const state = createInitialVfsState();

    expect(state.rootId).toBe("vfs-root");
    expect(state.revision).toBe(0);
    expect(state.nextNodeSequence).toBe(10);
    expect(state.trashEntriesByNodeId).toEqual({});
    expect(state.nodesById[state.rootId]?.kind).toBe("directory");
    expect(state.nodesById[state.specialLocations.trash]).toMatchObject({
      kind: "directory",
      childIds: [],
    });
    expect(state.specialLocations).toEqual({
      home: "vfs-user",
      desktopDirectory: "vfs-desktop",
      documents: "vfs-documents",
      downloads: "vfs-downloads",
      music: "vfs-music",
      pictures: "vfs-pictures",
      videos: "vfs-videos",
      trash: "vfs-trash-files",
      cdrom: "vfs-cdrom",
      floppy: "vfs-floppy",
    });
  });

  it("resolves the initial directory tree paths", () => {
    const state = createInitialVfsState();

    expect(expectOk(resolveVfsPath(state, "/")).id).toBe(state.rootId);
    expect(expectOk(resolveVfsPath(state, "/home")).id).toBe("vfs-home");
    expect(expectOk(resolveVfsPath(state, "/home/user")).id).toBe(state.specialLocations.home);
    expect(expectOk(resolveVfsPath(state, "/home/user/Desktop")).id).toBe(state.specialLocations.desktopDirectory);
    expect(expectOk(resolveVfsPath(state, "/home/user/Videos")).id).toBe(state.specialLocations.videos);
    expect(expectOk(resolveVfsPath(state, "/home/user/Documents/Welcome.md")).id).toBe("vfs-content-76cff3ce17d8a853403179f1");
    expect(expectOk(resolveVfsPath(state, "/media/cdrom")).id).toBe(state.specialLocations.cdrom);
    expect(expectOk(resolveVfsPath(state, "/media/floppy")).id).toBe(state.specialLocations.floppy);
    expect(expectOk(resolveVfsPath(state, VFS_TRASH_FILES_PATH)).id).toBe(state.specialLocations.trash);
    expect(resolveVfsPath(state, "/trash")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("keeps the navigable root, home, and user parent hierarchy explicit", () => {
    const state = createInitialVfsState();
    const root = expectOk(resolveVfsPath(state, "/"));
    const home = expectOk(resolveVfsPath(state, "/home"));
    const user = expectOk(resolveVfsPath(state, "/home/user"));

    expect(root.parentId).toBeNull();
    expect(home.parentId).toBe(root.id);
    expect(user.parentId).toBe(home.id);
    expect(expectOk(listVfsDirectory(state, "/")).map((node) => node.name)).toContain("home");
    expect(expectOk(listVfsDirectory(state, "/home")).map((node) => node.name)).toEqual(["user"]);
  });

  it("keeps special locations as directories and reverse paths stable", () => {
    const state = createInitialVfsState();

    Object.values(state.specialLocations).forEach((nodeId) => {
      expect(state.nodesById[nodeId]?.kind).toBe("directory");
    });
    expect(isProtectedVfsNode(state, state.specialLocations.videos)).toBe(true);
    expect(expectOk(getVfsPathForNode(state, state.specialLocations.documents))).toBe("/home/user/Documents");
    expect(expectOk(getVfsPathForNode(state, state.rootId))).toBe("/");
    expect(state.nodesById[state.specialLocations.documents]).toMatchObject({
      createdAt: PROJECT_EPOCH_TIMESTAMP,
      modifiedAt: expect.any(String),
    });
  });

  it("passes invariant validation", () => {
    expect(validateVfsState(createInitialVfsState())).toEqual([]);
  });

  it("mounts Videos after Pictures as one empty protected Home child", () => {
    const state = createInitialVfsState();
    const home = expectOk(resolveVfsPath(state, "/home/user"));
    const videos = expectOk(resolveVfsPath(state, "/home/user/Videos"));

    expect(videos).toMatchObject({
      id: "vfs-videos",
      kind: "directory",
      parentId: state.specialLocations.home,
      childIds: [],
      createdAt: PROJECT_EPOCH_TIMESTAMP,
      modifiedAt: "2026-09-21T23:03:19.015Z",
    });
    expect(home.kind === "directory" ? home.childIds.slice(0, 6).map((id) => state.nodesById[id]?.name) : []).toEqual([
      "Desktop",
      "Documents",
      "Downloads",
      "Music",
      "Pictures",
      "Videos",
    ]);
    expect(moveVfsNode(state, "/home/user/Videos", "/home/user/Downloads", { now: PROJECT_EPOCH_TIMESTAMP })).toMatchObject({
      ok: false,
      error: { code: "SPECIAL_LOCATION_OPERATION_FORBIDDEN" },
    });
    expect(moveVfsNodeToTrash(state, "/home/user/Videos", { now: PROJECT_EPOCH_TIMESTAMP })).toMatchObject({
      ok: false,
      error: { code: "SPECIAL_LOCATION_OPERATION_FORBIDDEN" },
    });
  });

  it("mounts canonical repository-owned Welcome Markdown and Notes text files into the existing Documents directory", () => {
    const state = createInitialVfsState();
    const welcome = expectOk(resolveVfsPath(state, "/home/user/Documents/Welcome.md"));
    const notes = expectOk(resolveVfsPath(state, "/home/user/Documents/Notes.txt"));
    const documents = expectOk(resolveVfsPath(state, "/home/user/Documents"));

    expect(documents).toMatchObject({ id: state.specialLocations.documents, kind: "directory" });
    expect(welcome).toMatchObject({
      id: "vfs-content-76cff3ce17d8a853403179f1",
      kind: "file",
      parentId: state.specialLocations.documents,
      mimeType: "text/markdown",
      content: { kind: "text", text: "# Welcome to die Nische\n\ndie Nische is a KDE 3-inspired web desktop.\n\nThis is a virtual in-memory file system.\n" },
      size: 111,
      createdAt: "2026-08-30T12:00:00.000Z",
      modifiedAt: "2026-09-26T14:19:27.801Z",
    });
    expect(notes).toMatchObject({
      id: "vfs-content-e594a065214576326cb903a5",
      kind: "file",
      parentId: state.specialLocations.documents,
      mimeType: "text/plain",
      content: { kind: "text", text: "Notes.txt lives only in browser memory for this prototype.\n" },
      size: 59,
      createdAt: "2026-08-30T12:00:00.000Z",
      modifiedAt: "2026-08-30T12:00:00.000Z",
    });
    expect((documents.kind === "directory" ? documents.childIds : []).filter((id) => id === welcome.id)).toHaveLength(1);
    expect((documents.kind === "directory" ? documents.childIds : []).filter((id) => id === notes.id)).toHaveLength(1);
  });

  it("mounts the independent repository-owned Pictures artwork as asset URLs", () => {
    const state = createInitialVfsState();
    const pictures = expectOk(resolveVfsPath(state, "/home/user/Pictures"));
    const image = pictures.kind === "directory"
      ? pictures.childIds.map((id) => state.nodesById[id]).find((node) => node?.kind === "file" && node.content.kind === "asset-url")
      : undefined;
    if (!image || image.kind !== "file" || image.content.kind !== "asset-url") throw new Error("Repository image fixture missing");

    expect(pictures).toMatchObject({ id: state.specialLocations.pictures, kind: "directory" });
    expect(image).toMatchObject({
      kind: "file",
      parentId: state.specialLocations.pictures,
      mimeType: "image/png",
      content: { kind: "asset-url" },
      createdAt: "2026-09-26T16:25:23.646Z",
      modifiedAt: "2026-09-26T16:25:23.646Z",
    });
    expect((pictures.kind === "directory" ? pictures.childIds : []).filter((id) => id === image.id)).toHaveLength(1);
  });

  it("keeps production sidecar metadata invisible and gives replacement artwork deterministic identities", () => {
    const state = createInitialVfsState();
    const expectedIds = {
      "/home/user/Documents/Notes.txt": "vfs-content-e594a065214576326cb903a5",
      "/home/user/Documents/Welcome.md": "vfs-content-76cff3ce17d8a853403179f1",
      "/home/user/Pictures/nische-archway-01.png": "vfs-content-dbc47b8602c48a237b93b7f3",
      "/home/user/Pictures/nische-archway-02.png": "vfs-content-d46f415f60a19c2171c00db3",
      "/home/user/Pictures/nische-archway-03.png": "vfs-content-04495288b28825854d06111e",
    } as const;

    Object.entries(expectedIds).forEach(([path, id]) => {
      expect(expectOk(resolveVfsPath(state, path)).id).toBe(id);
    });
    expect(resolveVfsPath(state, "/home/user/Pictures/badge_katie.png")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(resolveVfsPath(state, "/home/user/Pictures/badge_konqi.png")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(resolveVfsPath(state, "/home/user/Pictures/badge_kori.png")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(resolveVfsPath(state, "/home/user/Documents/.kde3-meta.json")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(resolveVfsPath(state, "/home/user/Pictures/.kde3-meta.json")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(resolveVfsPath(state, "/home/user/.kde3-meta.json")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("recreates the repository text baseline after runtime edits without retaining browser-session content", () => {
    const initial = createInitialVfsState();
    const changed = writeVfsTextFile(initial, "/home/user/Documents/Welcome.md", "runtime only\n", {
      now: "2026-09-13T00:00:00.000Z",
    });

    expect(changed).toMatchObject({ ok: true, value: { content: { kind: "text", text: "runtime only\n" } } });
    expect(readVfsTextFile(createInitialVfsState(), "/home/user/Documents/Welcome.md")).toMatchObject({
      ok: true,
      value: {
        id: "vfs-content-76cff3ce17d8a853403179f1",
        content: { kind: "text", text: "# Welcome to die Nische\n\ndie Nische is a KDE 3-inspired web desktop.\n\nThis is a virtual in-memory file system.\n" },
      },
    });
  });

  it("keeps Welcome and Notes as ordinary mutable runtime files", () => {
    const now = "2026-09-17T12:00:00.000Z";
    const initial = createInitialVfsState();
    const welcome = expectOk(resolveVfsPath(initial, "/home/user/Documents/Welcome.md"));
    const notes = expectOk(resolveVfsPath(initial, "/home/user/Documents/Notes.txt"));
    if (welcome.kind !== "file" || notes.kind !== "file") throw new Error("Repository document fixtures missing");

    expect(isProtectedVfsNode(initial, welcome.id)).toBe(false);
    expect(isProtectedVfsNode(initial, notes.id)).toBe(false);

    const edited = writeVfsTextFile(initial, "/home/user/Documents/Welcome.md", "Edited\n", { now });
    if (!edited.ok) throw new Error("Welcome edit failed");
    const renamed = renameVfsNode(edited.state, "/home/user/Documents/Welcome.md", "Intro.md", { now });
    if (!renamed.ok) throw new Error("Welcome rename failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Documents/Intro.md", "/home/user/Downloads", { now });
    if (!moved.ok) throw new Error("Welcome move failed");
    const copied = copyVfsNode(moved.state, "/home/user/Documents/Notes.txt", "/home/user/Downloads", { now, newName: "Notes Copy.txt" });
    if (!copied.ok) throw new Error("Notes copy failed");
    const trashed = moveVfsNodeToTrash(copied.state, "/home/user/Documents/Notes.txt", { now });
    if (!trashed.ok) throw new Error("Notes trash failed");
    const restored = restoreVfsNodeFromTrash(trashed.state, notes.id, { now });
    if (!restored.ok) throw new Error("Notes restore failed");
    const retrash = moveVfsNodeToTrash(restored.state, "/home/user/Documents/Notes.txt", { now });
    if (!retrash.ok) throw new Error("Notes retrash failed");
    const deleted = deleteVfsNodePermanently(retrash.state, notes.id, { now });
    if (!deleted.ok) throw new Error("Notes permanent delete failed");

    expect(expectOk(resolveVfsPath(deleted.state, "/home/user/Downloads/Intro.md"))).toMatchObject({ id: welcome.id, content: { kind: "text", text: "Edited\n" } });
    expect(expectOk(resolveVfsPath(deleted.state, "/home/user/Downloads/Notes Copy.txt"))).toMatchObject({ kind: "file" });
    expect(resolveVfsPath(deleted.state, "/home/user/Documents/Notes.txt")).toMatchObject({ ok: false });
  });
});
