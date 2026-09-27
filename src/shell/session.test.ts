import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../vfs/initialState";
import { moveVfsNodeToTrash, deleteVfsNodePermanently } from "../vfs/mutations";
import { appendShellPromptOnlyTranscript, clearShellTranscript, createInitialShellSession, validateShellCwd } from "./session";

describe("Shell session state", () => {
  it("starts at Home with independent arrays and deterministic ids", () => {
    const vfsState = createInitialVfsState();
    const first = createInitialShellSession(vfsState);
    const second = createInitialShellSession(vfsState);

    expect(first.cwdNodeId).toBe(vfsState.specialLocations.home);
    expect(first.transcript).toEqual([]);
    expect(first.commandHistory).toEqual([]);
    expect(first.nextTranscriptEntryId).toBe(1);
    expect(first.transcript).not.toBe(second.transcript);
    expect(first.commandHistory).not.toBe(second.commandHistory);
  });

  it("falls back to root when Home is unavailable", () => {
    const initial = createInitialVfsState();
    const withoutHome = {
      ...initial,
      nodesById: {
        ...initial.nodesById,
        [initial.specialLocations.home]: {
          ...initial.nodesById[initial.specialLocations.home],
          kind: "file" as const,
          encoding: "utf-8" as const,
          mimeType: "text/plain",
          content: { kind: "text" as const, text: "" },
          size: 0,
        },
      },
    };

    expect(createInitialShellSession(withoutHome).cwdNodeId).toBe(initial.rootId);
  });

  it("accepts a filesystem working directory during initial session construction", () => {
    const state = createInitialVfsState();

    expect(createInitialShellSession(state, "/home/user/Documents").cwdNodeId).toBe(state.specialLocations.documents);
    expect(createInitialShellSession(state, "/home/user/No such directory").cwdNodeId).toBe(state.specialLocations.home);
  });

  it("validates current cwd and reports fallback when it was deleted", () => {
    const initial = createInitialVfsState();
    const trashed = moveVfsNodeToTrash(initial, "/home/user/Documents/Notes.txt", {
      now: "2026-08-04T00:00:00.000Z",
    });

    if (!trashed.ok) {
      throw new Error("trash fixture failed");
    }

    const deleted = deleteVfsNodePermanently(trashed.state, "vfs-content-e594a065214576326cb903a5", {
      now: "2026-08-04T00:00:00.000Z",
    });

    if (!deleted.ok) {
      throw new Error("delete fixture failed");
    }

    const validation = validateShellCwd({ ...createInitialShellSession(initial), cwdNodeId: "vfs-content-e594a065214576326cb903a5" }, deleted.state);

    expect(validation.cwdNodeId).toBe(deleted.state.specialLocations.home);
    expect(validation.warning?.text).toBe("shell: current directory is no longer available; returned to /home/user");
    expect(validation.error?.code).toBe("CWD_UNAVAILABLE");
  });

  it("clears transcript without changing cwd, history, or next transcript id", () => {
    const vfsState = createInitialVfsState();
    const session = {
      ...createInitialShellSession(vfsState),
      transcript: [
        {
          id: 1,
          input: "pwd",
          cwdPath: "/home/user",
          output: [{ stream: "stdout" as const, text: "/home/user" }],
          exitCode: 0,
        },
      ],
      commandHistory: ["pwd"],
      nextTranscriptEntryId: 2,
    };
    const cleared = clearShellTranscript(session);

    expect(cleared).not.toBe(session);
    expect(cleared.transcript).toEqual([]);
    expect(cleared.commandHistory).toBe(session.commandHistory);
    expect(cleared.cwdNodeId).toBe(session.cwdNodeId);
    expect(cleared.nextTranscriptEntryId).toBe(2);
    expect(session.transcript).toHaveLength(1);
    expect(clearShellTranscript(cleared)).toBe(cleared);
  });

  it("appends prompt-only transcript entries without changing cwd or command history", () => {
    const vfsState = createInitialVfsState();
    const first = appendShellPromptOnlyTranscript(createInitialShellSession(vfsState), "/home/user");
    const second = appendShellPromptOnlyTranscript(first, "/home/user");

    expect(first.transcript).toEqual([
      { id: 1, input: "", cwdPath: "/home/user", output: [], exitCode: 0 },
    ]);
    expect(second.transcript.map((entry) => entry.id)).toEqual([1, 2]);
    expect(second.commandHistory).toEqual([]);
    expect(second.cwdNodeId).toBe(vfsState.specialLocations.home);
    expect(second.nextTranscriptEntryId).toBe(3);
  });
});
