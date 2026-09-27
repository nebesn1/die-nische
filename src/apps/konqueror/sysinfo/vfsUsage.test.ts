import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../../vfs/initialState";
import { createVfsTextFile, emptyVfsTrash, moveVfsNodeToTrash } from "../../../vfs/mutations";
import { summarizeVfsUsage } from "./vfsUsage";

describe("virtual VFS usage summary", () => {
  it("reports virtual text-file bytes using UTF-8 semantics", () => {
    const initial = createInitialVfsState();
    const created = createVfsTextFile(initial, "/home/user/Documents", "Unicode.txt", "机器人", {
      now: "2026-08-20T00:00:00.000Z",
    });

    if (!created.ok) {
      throw new Error("fixture creation failed");
    }

    const summary = summarizeVfsUsage(created.state);

    expect(summary.fileCount).toBeGreaterThan(0);
    expect(summary.usedBytes).toBeGreaterThanOrEqual(new TextEncoder().encode("机器人").byteLength);
  });

  it("is read-only and deterministic for the same VFS snapshot", () => {
    const state = createInitialVfsState();
    const first = summarizeVfsUsage(state);

    expect(summarizeVfsUsage(state)).toEqual(first);
    expect(state.revision).toBe(0);
  });

  it("retains virtual disk usage when moving to Trash and releases it only when emptied", () => {
    const initial = createInitialVfsState();
    const created = createVfsTextFile(initial, "/home/user/Documents", "Usage.txt", "Trash retains bytes", {
      now: "2026-08-21T00:00:00.000Z",
    });

    if (!created.ok) {
      throw new Error("fixture creation failed");
    }

    const trashed = moveVfsNodeToTrash(created.state, "/home/user/Documents/Usage.txt", {
      now: "2026-08-21T00:01:00.000Z",
    });

    if (!trashed.ok) {
      throw new Error("fixture Trash move failed");
    }

    const emptied = emptyVfsTrash(trashed.state, { now: "2026-08-21T00:02:00.000Z" });

    if (!emptied.ok) {
      throw new Error("fixture Trash empty failed");
    }

    expect(summarizeVfsUsage(trashed.state)).toEqual(summarizeVfsUsage(created.state));
    expect(summarizeVfsUsage(emptied.state).usedBytes).toBe(summarizeVfsUsage(initial).usedBytes);
  });
});
