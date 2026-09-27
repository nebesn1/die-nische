import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import { getVfsLinkTargetStatus, resolveVfsLinkTarget } from "./links";
import {
  copyVfsNode,
  createVfsDirectory,
  createVfsLinks,
  createVfsTextFile,
  deleteVfsNodePermanently,
  moveVfsNode,
  moveVfsNodeToTrash,
  renameVfsNode,
  restoreVfsNodeFromTrash,
} from "./mutations";
import { getVfsPathForNode, listVfsDirectory } from "./queries";
import type { VfsLinkNode, VfsState } from "./types";

const now = "2026-09-02T00:00:00.000Z";
const expectMutation = <T,>(result: { readonly ok: boolean; readonly state: VfsState; readonly value?: T }): { readonly state: VfsState; readonly value: T } => {
  if (!result.ok || result.value === undefined) throw new Error("Expected VFS mutation to succeed");
  return { state: result.state, value: result.value };
};

describe("VFS identity links", () => {
  it("creates ordered link leaves atomically from raw sources without ancestor normalization", () => {
    const folder = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now }));
    const child = expectMutation(createVfsTextFile(folder.state, "/home/user/Documents/A", "Child.txt", "child", { now }));
    const links = createVfsLinks(child.state, child.state.specialLocations.downloads, [folder.value.id, child.value.id], { now });
    const created = expectMutation(links);

    expect(created.value.map((link) => ({ name: link.name, targetNodeId: link.targetNodeId, parentId: link.parentId, kind: link.kind }))).toEqual([
      { name: "A", targetNodeId: folder.value.id, parentId: child.state.specialLocations.downloads, kind: "link" },
      { name: "Child.txt", targetNodeId: child.value.id, parentId: child.state.specialLocations.downloads, kind: "link" },
    ]);
    expect(created.value.every((link) => link.id !== link.targetNodeId)).toBe(true);
    expect(listVfsDirectory(created.state, "/home/user/Downloads")).toMatchObject({ ok: true, value: created.value });
  });

  it("rejects collision or stale batches before publishing any link", () => {
    const report = expectMutation(createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "report.txt", "one", { now }));
    const duplicate = expectMutation(createVfsTextFile(report.state, "/home/user/Pictures", "report.txt", "two", { now }));
    const revision = duplicate.state.revision;
    expect(createVfsLinks(duplicate.state, duplicate.state.specialLocations.downloads, [report.value.id, duplicate.value.id], { now })).toMatchObject({
      ok: false,
      state: duplicate.state,
      error: { code: "ALREADY_EXISTS" },
    });
    expect(duplicate.state.revision).toBe(revision);

    const stale = moveVfsNodeToTrash(duplicate.state, "/home/user/Documents/report.txt", { now });
    const trashed = expectMutation(stale);
    expect(createVfsLinks(trashed.state, trashed.state.specialLocations.downloads, [report.value.id, duplicate.value.id], { now })).toMatchObject({
      ok: false,
      state: trashed.state,
      error: { code: "INVALID_DESTINATION" },
    });
  });

  it("survives target rename and move, becomes unavailable in Trash, and revives after restore", () => {
    const created = expectMutation(createVfsLinks(createInitialVfsState(), "vfs-downloads", ["vfs-content-e594a065214576326cb903a5"], { now }));
    const link = created.value[0] as VfsLinkNode;
    const renamed = expectMutation(renameVfsNode(created.state, "/home/user/Documents/Notes.txt", "Final.txt", { now }));
    const moved = expectMutation(moveVfsNode(renamed.state, "/home/user/Documents/Final.txt", "/home/user/Music", { now }));

    expect(resolveVfsLinkTarget(moved.state, link.id)).toMatchObject({ ok: true, value: { node: { id: "vfs-content-e594a065214576326cb903a5" }, path: "/home/user/Music/Final.txt" } });
    const trashed = expectMutation(moveVfsNodeToTrash(moved.state, "/home/user/Music/Final.txt", { now }));
    expect(getVfsLinkTargetStatus(trashed.state, link.id)).toMatchObject({ type: "unavailable" });
    const restored = expectMutation(restoreVfsNodeFromTrash(trashed.state, "vfs-content-e594a065214576326cb903a5", { now }));
    expect(resolveVfsLinkTarget(restored.state, link.id)).toMatchObject({ ok: true, value: { node: { id: "vfs-content-e594a065214576326cb903a5" } } });
    expect(getVfsPathForNode(restored.state, link.id)).toMatchObject({ ok: true, value: "/home/user/Downloads/Notes.txt" });
  });

  it("keeps a broken link after permanent target deletion and guards corrupt link cycles", () => {
    const created = expectMutation(createVfsLinks(createInitialVfsState(), "vfs-downloads", ["vfs-content-e594a065214576326cb903a5"], { now }));
    const link = created.value[0] as VfsLinkNode;
    const trashed = expectMutation(moveVfsNodeToTrash(created.state, "/home/user/Documents/Notes.txt", { now }));
    const deleted = expectMutation(deleteVfsNodePermanently(trashed.state, "vfs-content-e594a065214576326cb903a5", { now }));
    expect(getVfsLinkTargetStatus(deleted.state, link.id)).toMatchObject({ type: "missing" });
    expect(deleted.state.nodesById[link.id]).toMatchObject({ kind: "link", targetNodeId: "vfs-content-e594a065214576326cb903a5" });

    const a: VfsLinkNode = { id: "link-a", parentId: "vfs-downloads", name: "A", kind: "link", targetNodeId: "link-b", createdAt: now, modifiedAt: now };
    const b: VfsLinkNode = { id: "link-b", parentId: "vfs-downloads", name: "B", kind: "link", targetNodeId: "link-a", createdAt: now, modifiedAt: now };
    const downloads = deleted.state.nodesById[deleted.state.specialLocations.downloads];
    if (!downloads || downloads.kind !== "directory") throw new Error("Downloads fixture missing");
    const cyclic: VfsState = {
      ...deleted.state,
      nodesById: {
        ...deleted.state.nodesById,
        [downloads.id]: { ...downloads, childIds: [...downloads.childIds, a.id, b.id] },
        [a.id]: a,
        [b.id]: b,
      },
    };
    expect(getVfsLinkTargetStatus(cyclic, a.id)).toMatchObject({ type: "cycle" });
    expect(resolveVfsLinkTarget(cyclic, a.id)).toMatchObject({ ok: false, error: { message: "The link target cannot be resolved." } });
  });

  it("copies links themselves, including links inside a copied directory, without cloning targets", () => {
    const folder = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Folder", { now }));
    const link = expectMutation(createVfsLinks(folder.state, folder.value.id, ["vfs-content-e594a065214576326cb903a5"], { now }));
    const copied = expectMutation(copyVfsNode(link.state, "/home/user/Documents/Folder", "/home/user/Downloads", { now }));
    const copiedChildrenResult = listVfsDirectory(copied.state, "/home/user/Downloads/Folder");
    if (!copiedChildrenResult.ok) throw new Error("Copied directory listing failed");
    const copiedChildren = copiedChildrenResult.value;
    const copiedLink = copiedChildren[0] as VfsLinkNode;

    expect(copied.value).toMatchObject({ kind: "directory", name: "Folder" });
    expect(copiedLink).toMatchObject({ kind: "link", targetNodeId: "vfs-content-e594a065214576326cb903a5" });
    expect(copiedLink.id).not.toBe(link.value[0]?.id);
    expect(copied.state.nodesById["vfs-content-e594a065214576326cb903a5"]?.parentId).toBe("vfs-documents");
  });

  it("renames, copies, moves, trashes, restores, and deletes only the Link node", () => {
    const created = expectMutation(createVfsLinks(createInitialVfsState(), "vfs-downloads", ["vfs-content-e594a065214576326cb903a5"], { now }));
    const link = created.value[0]!;
    const renamed = expectMutation(renameVfsNode(created.state, "/home/user/Downloads/Notes.txt", "Notes Link", { now }));
    const copied = expectMutation(copyVfsNode(renamed.state, "/home/user/Downloads/Notes Link", "/home/user/Music", { now }));
    const moved = expectMutation(moveVfsNode(copied.state, "/home/user/Downloads/Notes Link", "/home/user/Pictures", { now }));

    expect(copied.value).toMatchObject({ kind: "link", targetNodeId: "vfs-content-e594a065214576326cb903a5" });
    expect(moved.value).toMatchObject({ id: link.id, kind: "link", targetNodeId: "vfs-content-e594a065214576326cb903a5", parentId: "vfs-pictures" });
    expect(getVfsPathForNode(moved.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Documents/Notes.txt" });

    const trashed = expectMutation(moveVfsNodeToTrash(moved.state, "/home/user/Pictures/Notes Link", { now }));
    expect(trashed.state.nodesById[link.id]).toMatchObject({ kind: "link", targetNodeId: "vfs-content-e594a065214576326cb903a5" });
    expect(getVfsPathForNode(trashed.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Documents/Notes.txt" });
    const restored = expectMutation(restoreVfsNodeFromTrash(trashed.state, link.id, { now }));
    const deleted = expectMutation(moveVfsNodeToTrash(restored.state, "/home/user/Pictures/Notes Link", { now }));
    const permanentlyDeleted = expectMutation(deleteVfsNodePermanently(deleted.state, link.id, { now }));

    expect(permanentlyDeleted.state.nodesById[link.id]).toBeUndefined();
    expect(permanentlyDeleted.state.nodesById["vfs-content-e594a065214576326cb903a5"]?.parentId).toBe("vfs-documents");
  });
});
