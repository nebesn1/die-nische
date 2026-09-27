import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import {
  addKonsoleShellSession,
  closeKonsoleShellSession,
  createInitialKonsoleShellWindowState,
  getActiveKonsoleShellSession,
  normalizeKonsoleShellName,
  renameKonsoleShellSession,
  selectKonsoleShellSession,
} from "./konsoleShellSessions";

describe("Konsole shell session model", () => {
  it("creates Shell and allocates the lowest free slot without using array length", () => {
    const vfs = createInitialVfsState();
    let state = createInitialKonsoleShellWindowState(vfs);
    state = addKonsoleShellSession(state, vfs);
    state = addKonsoleShellSession(state, vfs);
    const second = state.sessions[1]!;

    expect(state.sessions.map((session) => [session.slotNumber, session.name])).toEqual([
      [1, "Shell"], [2, "Shell No. 2"], [3, "Shell No. 3"],
    ]);
    state = closeKonsoleShellSession(state, second.id);
    state = addKonsoleShellSession(state, vfs);

    expect(getActiveKonsoleShellSession(state)).toMatchObject({ slotNumber: 2, name: "Shell No. 2" });
  });

  it("keeps stable identity and slot allocation when a session is renamed", () => {
    const vfs = createInitialVfsState();
    let state = addKonsoleShellSession(createInitialKonsoleShellWindowState(vfs), vfs);
    const second = getActiveKonsoleShellSession(state);
    state = renameKonsoleShellSession(state, second.id, "Server");
    state = addKonsoleShellSession(state, vfs);

    expect(state.sessions.find((session) => session.id === second.id)).toMatchObject({ slotNumber: 2, name: "Server" });
    expect(getActiveKonsoleShellSession(state)).toMatchObject({ slotNumber: 3, name: "Shell No. 3" });
  });

  it("selects and closes exact stable sessions while retaining other session state", () => {
    const vfs = createInitialVfsState();
    let state = createInitialKonsoleShellWindowState(vfs);
    state = addKonsoleShellSession(state, vfs);
    const second = getActiveKonsoleShellSession(state);
    state = selectKonsoleShellSession(state, state.sessions[0]!.id);
    state = closeKonsoleShellSession(state, second.id);

    expect(getActiveKonsoleShellSession(state).id).toBe("shell-1");
    expect(state.sessions).toHaveLength(1);
    expect(closeKonsoleShellSession(state, "shell-1")).toBe(state);
  });

  it("uses the window's original launch directory for every new shell", () => {
    const vfs = createInitialVfsState();
    const state = addKonsoleShellSession(
      createInitialKonsoleShellWindowState(vfs, "/home/user/Documents"),
      vfs,
    );

    expect(state.sessions.map((session) => session.shell.cwdNodeId)).toEqual([
      vfs.specialLocations.documents,
      vfs.specialLocations.documents,
    ]);
  });

  it("normalizes names without allowing blank or oversized tab labels", () => {
    expect(normalizeKonsoleShellName("  Server  ")).toBe("Server");
    expect(normalizeKonsoleShellName("   ")).toBeNull();
    expect(normalizeKonsoleShellName("x".repeat(65))).toBeNull();
  });
});
