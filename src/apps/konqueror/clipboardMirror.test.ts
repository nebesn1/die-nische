import { describe, expect, it } from "vitest";
import { moveVfsNode, renameVfsNode } from "../../vfs/mutations";
import { createInitialVfsState } from "../../vfs/initialState";
import { getKonquerorClipboardMirrorUri } from "./clipboardMirror";

const now = "2003-04-06T12:30:00.000Z";

describe("Konqueror Klipper file URI mirror", () => {
  it("mirrors canonical files and directories without changing file clipboard identity", () => {
    const state = createInitialVfsState();

    expect(getKonquerorClipboardMirrorUri(state, "vfs-content-e594a065214576326cb903a5")).toBe("file:///home/user/Documents/Notes.txt");
    expect(getKonquerorClipboardMirrorUri(state, state.specialLocations.documents)).toBe("file:///home/user/Documents");
  });

  it("uses the latest canonical path after rename and move", () => {
    const initial = createInitialVfsState();
    const renamed = renameVfsNode(initial, "/home/user/Documents/Notes.txt", "机器人 File.txt", { now });
    if (!renamed.ok) {
      throw new Error("rename fixture failed");
    }

    expect(getKonquerorClipboardMirrorUri(renamed.state, "vfs-content-e594a065214576326cb903a5")).toBe(
      "file:///home/user/Documents/%E6%9C%BA%E5%99%A8%E4%BA%BA%20File.txt",
    );

    const moved = moveVfsNode(renamed.state, "/home/user/Documents/机器人 File.txt", "/home/user/Downloads", { now });
    if (!moved.ok) {
      throw new Error("move fixture failed");
    }

    expect(getKonquerorClipboardMirrorUri(moved.state, "vfs-content-e594a065214576326cb903a5")).toBe(
      "file:///home/user/Downloads/%E6%9C%BA%E5%99%A8%E4%BA%BA%20File.txt",
    );
  });

  it("does not synthesize a URI for a deleted node", () => {
    expect(getKonquerorClipboardMirrorUri(createInitialVfsState(), "missing-node")).toBeNull();
  });
});
