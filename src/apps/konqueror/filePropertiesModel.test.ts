import { describe, expect, it } from "vitest";
import {
  deleteVfsNodePermanently,
  moveVfsNode,
  moveVfsNodeToTrash,
  renameVfsNode,
  restoreVfsNodeFromTrash,
  writeVfsTextFile,
} from "../../vfs/mutations";
import { createVfsLinks } from "../../vfs/mutations";
import { createInitialVfsState } from "../../vfs/initialState";
import { deriveKonquerorFileProperties } from "./filePropertiesModel";
import { formatKonquerorTimestamp } from "./formatters";

const timestamp = "2026-08-12T14:30:00.000Z";

const expectAvailable = (result: ReturnType<typeof deriveKonquerorFileProperties>) => {
  if (result.type !== "available") {
    throw new Error("expected available Properties metadata");
  }

  return result.properties;
};

describe("Konqueror file Properties model", () => {
  it("derives read-only text-file and directory metadata through stable node ids", () => {
    const state = createInitialVfsState();
    const file = expectAvailable(deriveKonquerorFileProperties(state, "vfs-content-e594a065214576326cb903a5"));
    const directory = expectAvailable(deriveKonquerorFileProperties(state, state.specialLocations.documents));

    expect(file).toMatchObject({
      nodeId: "vfs-content-e594a065214576326cb903a5",
      name: "Notes.txt",
      typeLabel: "Text Document",
      location: "/home/user/Documents",
      fullPath: "/home/user/Documents/Notes.txt",
      sizeLabel: "59 B",
      createdLabel: formatKonquerorTimestamp("2026-08-30T12:00:00.000Z"),
      modifiedLabel: formatKonquerorTimestamp("2026-08-30T12:00:00.000Z"),
      iconId: "text-file",
    });
    expect(directory).toMatchObject({
      nodeId: state.specialLocations.documents,
      name: "Documents",
      typeLabel: "Directory",
      location: "/home/user",
      fullPath: "/home/user/Documents",
      sizeLabel: "-",
      iconId: "documents",
    });
  });

  it("tracks rename, move, content size, and modified time without changing the backing identity", () => {
    const initial = createInitialVfsState();
    const renamed = renameVfsNode(initial, "/home/user/Documents/Notes.txt", "Renamed.txt", { now: timestamp });
    if (!renamed.ok) throw new Error("rename fixture failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Documents/Renamed.txt", "/home/user/Downloads", { now: timestamp });
    if (!moved.ok) throw new Error("move fixture failed");
    const written = writeVfsTextFile(moved.state, "/home/user/Downloads/Renamed.txt", "测试", {
      now: "2026-08-12T15:00:00.000Z",
    });
    if (!written.ok) throw new Error("write fixture failed");

    const properties = expectAvailable(deriveKonquerorFileProperties(written.state, "vfs-content-e594a065214576326cb903a5"));

    expect(properties).toMatchObject({
      nodeId: "vfs-content-e594a065214576326cb903a5",
      name: "Renamed.txt",
      location: "/home/user/Downloads",
      fullPath: "/home/user/Downloads/Renamed.txt",
      sizeLabel: "6 B",
      createdLabel: formatKonquerorTimestamp("2026-08-30T12:00:00.000Z"),
      modifiedLabel: formatKonquerorTimestamp("2026-08-12T15:00:00.000Z"),
    });
  });

  it("tracks the same node through Trash and Restore, then reports permanent deletion safely", () => {
    const initial = createInitialVfsState();
    const trashed = moveVfsNodeToTrash(initial, "/home/user/Documents/Notes.txt", { now: timestamp });
    if (!trashed.ok) throw new Error("trash fixture failed");

    expect(expectAvailable(deriveKonquerorFileProperties(trashed.state, "vfs-content-e594a065214576326cb903a5"))).toMatchObject({
      nodeId: "vfs-content-e594a065214576326cb903a5",
      location: "/home/user/.local/share/Trash/files",
      fullPath: "/home/user/.local/share/Trash/files/Notes.txt",
    });

    const restored = restoreVfsNodeFromTrash(trashed.state, "vfs-content-e594a065214576326cb903a5", { now: "2026-08-12T15:00:00.000Z" });
    if (!restored.ok) throw new Error("restore fixture failed");
    expect(expectAvailable(deriveKonquerorFileProperties(restored.state, "vfs-content-e594a065214576326cb903a5"))).toMatchObject({
      location: "/home/user/Documents",
      fullPath: "/home/user/Documents/Notes.txt",
    });

    const trashedAgain = moveVfsNodeToTrash(restored.state, "/home/user/Documents/Notes.txt", {
      now: "2026-08-12T16:00:00.000Z",
    });
    if (!trashedAgain.ok) throw new Error("second trash fixture failed");
    const deleted = deleteVfsNodePermanently(trashedAgain.state, "vfs-content-e594a065214576326cb903a5", { now: "2026-08-12T17:00:00.000Z" });
    if (!deleted.ok) throw new Error("delete fixture failed");

    expect(deriveKonquerorFileProperties(deleted.state, "vfs-content-e594a065214576326cb903a5")).toEqual({ type: "unavailable" });
  });

  it("uses the existing safe local timestamp formatter for invalid values", () => {
    expect(formatKonquerorTimestamp("not-a-timestamp")).toBe("-");
  });

  it("keeps Link names independent while resolving the current stable target path", () => {
    const linked = createVfsLinks(createInitialVfsState(), "vfs-downloads", ["vfs-content-e594a065214576326cb903a5"], { now: timestamp });
    if (!linked.ok) throw new Error("Link fixture failed");
    const link = linked.value[0]!;
    const renamed = renameVfsNode(linked.state, "/home/user/Documents/Notes.txt", "Final.txt", { now: timestamp });
    if (!renamed.ok) throw new Error("Rename fixture failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Documents/Final.txt", "/home/user/Music", { now: timestamp });
    if (!moved.ok) throw new Error("Move fixture failed");

    expect(expectAvailable(deriveKonquerorFileProperties(moved.state, link.id))).toMatchObject({
      name: "Notes.txt",
      typeLabel: "Link",
      sizeLabel: "0 B",
      target: "/home/user/Music/Final.txt",
    });
    const trashed = moveVfsNodeToTrash(moved.state, "/home/user/Music/Final.txt", { now: timestamp });
    if (!trashed.ok) throw new Error("Trash fixture failed");
    expect(expectAvailable(deriveKonquerorFileProperties(trashed.state, link.id))).toMatchObject({
      typeLabel: "Broken Link",
      target: "Missing or unavailable",
    });
  });
});
