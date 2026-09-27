import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { moveVfsNode, renameVfsNode } from "../../vfs/mutations";
import type { VfsState } from "../../vfs/types";
import { getKFindSaveFilename, serializeKFindResults } from "./saveResults";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) throw new Error("Expected mutation");
  return result;
};

describe("KFind Save Results serialization", () => {
  it("uses one canonical VFS URL per stable result id in display order with LF trailing newline", () => {
    const state = createInitialVfsState();
    const serialized = serializeKFindResults(state, ["vfs-content-e594a065214576326cb903a5", state.specialLocations.documents]);
    expect(serialized).toEqual({ ok: true, value: "file:///home/user/Documents/Notes.txt\nfile:///home/user/Documents\n" });
  });

  it("resolves renamed and moved stable nodes live and fails atomically when unavailable", () => {
    const initial = createInitialVfsState();
    const renamed = expectMutation(renameVfsNode(initial, "/home/user/Documents/Notes.txt", "Renamed.txt", { now: "2026-08-12T00:00:00.000Z" }));
    const moved = expectMutation(moveVfsNode(renamed.state, "/home/user/Documents/Renamed.txt", "/home/user/Downloads", { now: "2026-08-12T00:00:00.000Z" }));
    expect(serializeKFindResults(moved.state, ["vfs-content-e594a065214576326cb903a5"])).toEqual({ ok: true, value: "file:///home/user/Downloads/Renamed.txt\n" });
    expect(serializeKFindResults(moved.state, ["missing"])).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("adds exactly one .txt extension only when enabled", () => {
    expect(getKFindSaveFilename("A", true)).toBe("A.txt");
    expect(getKFindSaveFilename("A.txt", true)).toBe("A.txt");
    expect(getKFindSaveFilename("A.TXT", true)).toBe("A.TXT");
    expect(getKFindSaveFilename("A", false)).toBe("A");
  });
});
