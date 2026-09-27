import { describe, expect, it, vi } from "vitest";
import { createInitialVfsState } from "../vfs/initialState";
import { createVfsDirectory, createVfsTextFile, moveVfsNodeToTrash } from "../vfs/mutations";
import { listVfsTrashEntries, resolveVfsPath } from "../vfs/queries";
import { createVfsOperations } from "../vfs/vfsOperations";
import type { VfsState } from "../vfs/types";
import { executeShellInput } from "./execution";
import { createInitialShellSession } from "./session";
import type { ShellInputExecutionResult, ShellMutationPort, ShellSessionState } from "./types";

const fixedNow = "2003-04-06T12:30:00.000Z";

const outputText = (result: ShellInputExecutionResult): string =>
  result.execution?.output.map((chunk) => chunk.text).join("\n") ?? "";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): VfsState => {
  if (!result.ok) {
    throw new Error("fixture mutation failed");
  }

  return result.state;
};

const createMutableShellVfs = (initialState = createInitialVfsState()) => {
  let state = initialState;
  const operations = createVfsOperations(
    () => state,
    (nextState) => {
      state = nextState;
    },
  );
  const mutations: ShellMutationPort = {
    createDirectory: operations.createDirectory,
    createTextFile: operations.createTextFile,
    appendTextFile: operations.appendTextFile,
    copyNode: operations.copyNode,
    moveNode: operations.moveNode,
    moveNodeToTrash: operations.moveNodeToTrash,
    restoreNodeFromTrash: operations.restoreNodeFromTrash,
    deleteNodePermanently: operations.deleteNodePermanently,
    emptyTrash: operations.emptyTrash,
  };

  return {
    get state(): VfsState {
      return state;
    },
    operations,
    mutations,
  };
};

const run = (
  session: ShellSessionState,
  fixture: ReturnType<typeof createMutableShellVfs>,
  input: string,
): ShellInputExecutionResult =>
  executeShellInput(session, fixture.state, input, {
    mutations: fixture.mutations,
    now: () => fixedNow,
  });

const createMockMutationPort = (): ShellMutationPort => ({
  createDirectory: vi.fn(),
  createTextFile: vi.fn(),
  appendTextFile: vi.fn(),
  copyNode: vi.fn(),
  moveNode: vi.fn(),
  moveNodeToTrash: vi.fn(),
  restoreNodeFromTrash: vi.fn(),
  deleteNodePermanently: vi.fn(),
  emptyTrash: vi.fn(),
});

describe("Shell Trash management commands", () => {
  it("restores files and directory subtrees through the mutation port", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir RestoreMe").session;
    session = run(session, fixture, "touch RestoreMe/Notes.txt").session;
    const directoryBeforeTrash = resolveVfsPath(fixture.state, "/home/user/Documents/RestoreMe");
    session = run(session, fixture, "trash RestoreMe").session;
    const restored = run(session, fixture, "restore /home/user/.local/share/Trash/files/RestoreMe");
    session = restored.session;
    const listed = run(session, fixture, "ls RestoreMe");
    const directoryAfterRestore = resolveVfsPath(fixture.state, "/home/user/Documents/RestoreMe");

    expect(restored.execution?.exitCode).toBe(0);
    expect(outputText(restored)).toBe("");
    expect(outputText(listed)).toBe("Notes.txt");
    expect(directoryBeforeTrash.ok && directoryAfterRestore.ok && directoryBeforeTrash.value.id === directoryAfterRestore.value.id).toBe(true);
    expect(listVfsTrashEntries(fixture.state)).toMatchObject({ ok: true, value: [] });
    expect(session.commandHistory).toContain("restore /home/user/.local/share/Trash/files/RestoreMe");
  });

  it("resolves Trash entries from /home/user/.local/share/Trash/files cwd, quoted names, and generated conflict names", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Current Tasks.txt", "", { now: fixedNow }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Downloads", "Current Tasks.txt", "", { now: fixedNow }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Current Tasks.txt", { now: fixedNow }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Downloads/Current Tasks.txt", { now: fixedNow }));
    const fixture = createMutableShellVfs(state);
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd /home/user/.local/share/Trash/files").session;
    const first = run(session, fixture, 'restore "Current Tasks.txt"');
    const second = run(first.session, fixture, 'restore "Current Tasks (1).txt"');

    expect(first.execution?.exitCode).toBe(0);
    expect(second.execution?.exitCode).toBe(0);
    expect(resolveVfsPath(fixture.state, "/home/user/Documents/Current Tasks.txt").ok).toBe(true);
    expect(resolveVfsPath(fixture.state, "/home/user/Downloads/Current Tasks.txt").ok).toBe(true);
  });

  it("rejects non-entry operands and Trash descendants without deleting metadata", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir Project").session;
    session = run(session, fixture, "touch Project/Plan.txt").session;
    session = run(session, fixture, "trash Project").session;
    const root = run(session, fixture, "restore /home/user/.local/share/Trash/files");
    const ordinary = run(root.session, fixture, "restore /home/user/Documents");
    const nested = run(ordinary.session, fixture, "restore /home/user/.local/share/Trash/files/Project/Plan.txt");

    expect(outputText(root)).toBe("restore: only top-level Trash items can be managed: /home/user/.local/share/Trash/files");
    expect(outputText(ordinary)).toBe("restore: not a top-level Trash item: /home/user/Documents");
    expect(outputText(nested)).toBe("restore: only top-level Trash items can be managed: /home/user/.local/share/Trash/files/Project/Plan.txt");
    expect(listVfsTrashEntries(fixture.state)).toMatchObject({ ok: true, value: [{ node: { name: "Project" } }] });
  });

  it("maps restore conflict and unavailable original parent errors", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "Project", { now: fixedNow }));
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents/Project", "Subfolder", { now: fixedNow }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/Project/Subfolder", "Plan.txt", "old", { now: fixedNow }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project/Subfolder/Plan.txt", { now: fixedNow }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/Project/Subfolder", "Plan.txt", "new", { now: fixedNow }));
    let fixture = createMutableShellVfs(state);
    let session = createInitialShellSession(fixture.state);
    const conflict = run(session, fixture, "restore /home/user/.local/share/Trash/files/Plan.txt");

    expect(conflict.execution?.exitCode).toBe(1);
    expect(outputText(conflict)).toBe("restore: an item with this name already exists in the original folder");
    expect(listVfsTrashEntries(fixture.state)).toMatchObject({ ok: true, value: [{ node: { name: "Plan.txt" } }] });

    state = createInitialVfsState();
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "Project", { now: fixedNow }));
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents/Project", "Subfolder", { now: fixedNow }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/Project/Subfolder", "Plan.txt", "old", { now: fixedNow }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project/Subfolder/Plan.txt", { now: fixedNow }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now: fixedNow }));
    fixture = createMutableShellVfs(state);
    session = createInitialShellSession(fixture.state);
    const unavailable = run(session, fixture, "restore /home/user/.local/share/Trash/files/Plan.txt");
    const restoreParent = run(unavailable.session, fixture, "restore /home/user/.local/share/Trash/files/Project");
    const restoreChild = run(restoreParent.session, fixture, "restore /home/user/.local/share/Trash/files/Plan.txt");

    expect(outputText(unavailable)).toBe("restore: the original folder is no longer available");
    expect(restoreParent.execution?.exitCode).toBe(0);
    expect(restoreChild.execution?.exitCode).toBe(0);
  });

  it("restores a cwd tree while preserving the stable cwd node id", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir RestoreCwd").session;
    session = run(session, fixture, "trash RestoreCwd").session;
    session = run(session, fixture, "cd /home/user/.local/share/Trash/files/RestoreCwd").session;
    const cwdNodeId = session.cwdNodeId;
    const restored = run(session, fixture, "restore /home/user/.local/share/Trash/files/RestoreCwd");
    const pwd = run(restored.session, fixture, "pwd");

    expect(restored.session.cwdNodeId).toBe(cwdNodeId);
    expect(outputText(pwd)).toBe("/home/user/Documents/RestoreCwd");
  });

  it("requires explicit confirmation before permanent delete and does not call port or clock before confirmation", () => {
    let state = createInitialVfsState();
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Notes.txt", { now: fixedNow }));
    const session = createInitialShellSession(state);
    const port = createMockMutationPort();
    const clock = vi.fn(() => fixedNow);
    const unconfirmed = executeShellInput(session, state, "permanent-delete /home/user/.local/share/Trash/files/Notes.txt", {
      mutations: port,
      now: clock,
    });

    expect(unconfirmed.execution?.exitCode).toBe(2);
    expect(outputText(unconfirmed)).toBe([
      "permanent-delete: this action cannot be undone",
      "Re-run with --confirm to permanently delete the item.",
    ].join("\n"));
    expect(port.deleteNodePermanently).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(unconfirmed.session.commandHistory).toEqual(["permanent-delete /home/user/.local/share/Trash/files/Notes.txt"]);
  });

  it("permanently deletes a complete Trash subtree only with --confirm", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir DeleteMe").session;
    session = run(session, fixture, "touch DeleteMe/Plan.txt").session;
    session = run(session, fixture, "trash DeleteMe").session;
    const beforeRevision = fixture.state.revision;
    const deleted = run(session, fixture, "permanent-delete --confirm /home/user/.local/share/Trash/files/DeleteMe");

    expect(deleted.execution?.exitCode).toBe(0);
    expect(resolveVfsPath(fixture.state, "/home/user/.local/share/Trash/files/DeleteMe").ok).toBe(false);
    expect(resolveVfsPath(fixture.state, "/home/user/.local/share/Trash/files/DeleteMe/Plan.txt").ok).toBe(false);
    expect(fixture.state.revision).toBe(beforeRevision + 1);
    expect(deleted.session.commandHistory.at(-1)).toBe("permanent-delete --confirm /home/user/.local/share/Trash/files/DeleteMe");
  });

  it("rejects permanent-delete argument errors, ordinary nodes, and nested descendants", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir Project").session;
    session = run(session, fixture, "touch Project/Plan.txt").session;
    session = run(session, fixture, "trash Project").session;
    const wrongOrder = run(session, fixture, "permanent-delete /home/user/.local/share/Trash/files/Project --confirm");
    const missing = run(wrongOrder.session, fixture, "permanent-delete --confirm");
    const ordinary = run(missing.session, fixture, "permanent-delete --confirm /home/user/Documents");
    const nested = run(ordinary.session, fixture, "permanent-delete --confirm /home/user/.local/share/Trash/files/Project/Plan.txt");

    expect(outputText(wrongOrder)).toBe("permanent-delete: unsupported option: --confirm");
    expect(outputText(missing)).toBe("permanent-delete --confirm requires a Trash entry.");
    expect(outputText(ordinary)).toBe("permanent-delete: not a top-level Trash item: /home/user/Documents");
    expect(outputText(nested)).toBe("permanent-delete: only top-level Trash items can be managed: /home/user/.local/share/Trash/files/Project/Plan.txt");
  });

  it("falls back on the next command after permanently deleting the current cwd subtree", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir DeleteCwd").session;
    session = run(session, fixture, "trash DeleteCwd").session;
    session = run(session, fixture, "cd /home/user/.local/share/Trash/files/DeleteCwd").session;
    session = run(session, fixture, "permanent-delete --confirm /home/user/.local/share/Trash/files/DeleteCwd").session;
    const pwd = run(session, fixture, "pwd");

    expect(pwd.execution?.output[0]).toEqual({
      stream: "system",
      text: "shell: current directory is no longer available; returned to /home/user",
    });
    expect(outputText(pwd)).toBe("shell: current directory is no longer available; returned to /home/user\n/home/user");
  });

  it("requires explicit confirmation before empty Trash and treats confirmed empty Trash as a safe no-op", () => {
    let state = createInitialVfsState();
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Notes.txt", { now: fixedNow }));
    const fixture = createMutableShellVfs(state);
    const session = createInitialShellSession(fixture.state);
    const port = createMockMutationPort();
    const clock = vi.fn(() => fixedNow);
    const unconfirmed = executeShellInput(session, fixture.state, "empty-trash", {
      mutations: port,
      now: clock,
    });

    expect(unconfirmed.execution?.exitCode).toBe(2);
    expect(outputText(unconfirmed)).toBe([
      "empty-trash: this action cannot be undone",
      "Re-run with --confirm to permanently delete all Trash items.",
    ].join("\n"));
    expect(port.emptyTrash).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();

    const beforeRevision = fixture.state.revision;
    const emptied = run(session, fixture, "empty-trash --confirm");
    const emptyAgain = run(emptied.session, fixture, "empty-trash --confirm");

    expect(emptied.execution?.exitCode).toBe(0);
    expect(listVfsTrashEntries(fixture.state)).toMatchObject({ ok: true, value: [] });
    expect(fixture.state.revision).toBe(beforeRevision + 1);
    expect(emptyAgain.execution?.exitCode).toBe(0);
    expect(fixture.state.revision).toBe(beforeRevision + 1);
  });

  it("keeps Trash root cwd valid when emptying Trash but falls back from deleted Trash descendants", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir EmptyCwd").session;
    session = run(session, fixture, "trash EmptyCwd").session;
    const trashRootSession = run(session, fixture, "cd /home/user/.local/share/Trash/files").session;
    const emptiedFromRoot = run(trashRootSession, fixture, "empty-trash --confirm");
    const rootPwd = run(emptiedFromRoot.session, fixture, "pwd");

    expect(outputText(rootPwd)).toBe("/home/user/.local/share/Trash/files");

    session = run(createInitialShellSession(fixture.state), fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir EmptyDescendant").session;
    session = run(session, fixture, "trash EmptyDescendant").session;
    session = run(session, fixture, "cd /home/user/.local/share/Trash/files/EmptyDescendant").session;
    session = run(session, fixture, "empty-trash --confirm").session;
    const fallback = run(session, fixture, "pwd");

    expect(outputText(fallback)).toBe("shell: current directory is no longer available; returned to /home/user\n/home/user");
  });

  it("uses latest provider state for quick Trash management sequences", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir A").session;
    session = run(session, fixture, "trash A").session;
    session = run(session, fixture, "restore /home/user/.local/share/Trash/files/A").session;
    session = run(session, fixture, "trash A").session;
    const deleted = run(session, fixture, "permanent-delete --confirm /home/user/.local/share/Trash/files/A");

    expect(deleted.execution?.exitCode).toBe(0);
    expect(deleted.session.transcript.map((entry) => entry.input)).toEqual([
      "cd Documents",
      "mkdir A",
      "trash A",
      "restore /home/user/.local/share/Trash/files/A",
      "trash A",
      "permanent-delete --confirm /home/user/.local/share/Trash/files/A",
    ]);
    expect(resolveVfsPath(fixture.state, "/home/user/Documents/A").ok).toBe(false);
    expect(resolveVfsPath(fixture.state, "/home/user/.local/share/Trash/files/A").ok).toBe(false);
  });
});
