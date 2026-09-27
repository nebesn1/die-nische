import { describe, expect, it, vi } from "vitest";
import { createInitialVfsState } from "../vfs/initialState";
import { resolveVfsPath } from "../vfs/queries";
import { createVfsOperations } from "../vfs/vfsOperations";
import type { VfsState } from "../vfs/types";
import { executeShellInput } from "./execution";
import { createInitialShellSession } from "./session";
import type { ShellInputExecutionResult, ShellMutationPort, ShellSessionState } from "./types";

const fixedNow = "2003-04-06T12:30:00.000Z";

const outputText = (result: ShellInputExecutionResult): string =>
  result.execution?.output.map((chunk) => chunk.text).join("\n") ?? "";

const createMutableShellVfs = () => {
  let state = createInitialVfsState();
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

describe("Shell mutation commands", () => {
  it("keeps read-only commands working without a mutation port", () => {
    const state = createInitialVfsState();
    const result = executeShellInput(createInitialShellSession(state), state, "pwd");

    expect(result.execution?.exitCode).toBe(0);
    expect(outputText(result)).toBe("/home/user");
  });

  it("returns a controlled error without calling the clock when mutation port is missing", () => {
    const state = createInitialVfsState();
    const clock = vi.fn(() => fixedNow);
    const result = executeShellInput(createInitialShellSession(state), state, "mkdir Projects", {
      now: clock,
    });

    expect(result.execution?.exitCode).toBe(1);
    expect(outputText(result)).toBe("shell: write operations are not available in this session");
    expect(clock).not.toHaveBeenCalled();
    expect(result.session.commandHistory).toEqual(["mkdir Projects"]);
  });

  it("creates directories and empty text files through the mutation port", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    const mkdir = run(session, fixture, "mkdir ShellProjects");
    session = mkdir.session;
    const touch = run(session, fixture, "touch ShellProjects/Notes.txt");
    session = touch.session;
    const listed = run(session, fixture, "ls ShellProjects");

    const directory = resolveVfsPath(fixture.state, "/home/user/Documents/ShellProjects");
    const file = resolveVfsPath(fixture.state, "/home/user/Documents/ShellProjects/Notes.txt");

    expect(mkdir.execution?.exitCode).toBe(0);
    expect(touch.execution?.exitCode).toBe(0);
    expect(outputText(listed)).toBe("Notes.txt");
    expect(directory.ok && directory.value.kind).toBe("directory");
    expect(file.ok && file.value.kind).toBe("file");
    expect(file.ok && file.value.kind === "file" && file.value.content.kind === "text" ? file.value.content.text : null).toBe("");
    expect(file.ok && file.value.kind === "file" ? file.value.size : null).toBe(0);
    expect(file.ok && file.value.kind === "file" ? file.value.mimeType : null).toBe("text/plain");
    expect(fixture.state.revision).toBe(2);
    expect(listed.session.transcript.map((entry) => entry.input)).toEqual([
      "cd Documents",
      "mkdir ShellProjects",
      "touch ShellProjects/Notes.txt",
      "ls ShellProjects",
    ]);
  });

  it("uses the shared tilde resolver for mutation path operands", () => {
    const fixture = createMutableShellVfs();
    const session = createInitialShellSession(fixture.state);
    const mkdir = run(session, fixture, "mkdir ~/TildeProjects");
    const touch = run(mkdir.session, fixture, "touch ~/TildeProjects/Notes.txt");
    const copied = run(touch.session, fixture, "cp ~/TildeProjects ~/Downloads");
    const moved = run(copied.session, fixture, "mv ~/Downloads/TildeProjects ~/Downloads/Renamed");
    const trashed = run(moved.session, fixture, "trash ~/Downloads/Renamed");
    const restored = run(trashed.session, fixture, "restore ~/.local/share/Trash/files/Renamed");

    expect(mkdir.execution?.exitCode).toBe(0);
    expect(touch.execution?.exitCode).toBe(0);
    expect(copied.execution?.exitCode).toBe(0);
    expect(moved.execution?.exitCode).toBe(0);
    expect(trashed.execution?.exitCode).toBe(0);
    expect(restored.execution?.exitCode).toBe(0);
    expect(resolveVfsPath(fixture.state, "/home/user/Downloads/Renamed/Notes.txt").ok).toBe(true);
  });

  it("keeps touch of an existing file as a successful no-op", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "touch Documents/Notes.txt").session;
    const before = resolveVfsPath(fixture.state, "/home/user/Documents/Notes.txt");
    const beforeRevision = fixture.state.revision;
    const touched = run(session, fixture, "touch Documents/Notes.txt");
    const after = resolveVfsPath(fixture.state, "/home/user/Documents/Notes.txt");

    expect(touched.execution?.exitCode).toBe(0);
    expect(touched.execution?.output).toEqual([]);
    expect(fixture.state.revision).toBe(beforeRevision);
    expect(before.ok && after.ok && before.value === after.value).toBe(true);
  });

  it("reports mkdir and touch usage, unsupported options, and directory targets", () => {
    const fixture = createMutableShellVfs();
    const session = createInitialShellSession(fixture.state);
    const missingArg = run(session, fixture, "mkdir");
    const option = run(missingArg.session, fixture, "mkdir -p Projects");
    const touchDirectory = run(option.session, fixture, "touch Documents");

    expect(missingArg.execution?.exitCode).toBe(2);
    expect(option.execution?.exitCode).toBe(2);
    expect(outputText(option)).toBe("mkdir: unsupported option: -p");
    expect(touchDirectory.execution?.exitCode).toBe(1);
    expect(outputText(touchDirectory)).toBe("touch: is a directory: Documents");
  });

  it("copies files and directories with directory and new-name destination semantics", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir ShellProjects").session;
    session = run(session, fixture, "touch ShellProjects/Notes.txt").session;
    const sourceFile = resolveVfsPath(fixture.state, "/home/user/Documents/ShellProjects/Notes.txt");
    const beforeSequence = fixture.state.nextNodeSequence;
    const copyToDirectory = run(session, fixture, "cp ShellProjects ../Downloads");
    session = copyToDirectory.session;
    const copyToNewName = run(session, fixture, "cp ShellProjects ../Downloads/ShellProjectsBackup");
    const copiedDirectory = resolveVfsPath(fixture.state, "/home/user/Downloads/ShellProjects");
    const copiedFile = resolveVfsPath(fixture.state, "/home/user/Downloads/ShellProjects/Notes.txt");
    const backup = resolveVfsPath(fixture.state, "/home/user/Downloads/ShellProjectsBackup");
    const conflict = run(copyToNewName.session, fixture, "cp ShellProjects .");

    expect(copyToDirectory.execution?.exitCode).toBe(0);
    expect(copyToNewName.execution?.exitCode).toBe(0);
    expect(copiedDirectory.ok && copiedDirectory.value.kind).toBe("directory");
    expect(backup.ok && backup.value.kind).toBe("directory");
    expect(sourceFile.ok && copiedFile.ok && sourceFile.value.id === copiedFile.value.id).toBe(false);
    expect(fixture.state.nextNodeSequence).toBe(beforeSequence + 4);
    expect(conflict.execution?.exitCode).toBe(1);
    expect(outputText(conflict)).toBe("cp: destination already exists: .");
  });

  it("moves files and directories while preserving node ids and updating moved cwd paths", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir Temporary").session;
    session = run(session, fixture, "cd Temporary").session;
    const cwdBefore = session.cwdNodeId;
    const movedCwd = run(session, fixture, "mv /home/user/Documents/Temporary /home/user/Downloads/Temporary");
    session = movedCwd.session;
    const pwd = run(session, fixture, "pwd");
    const samePathRevision = fixture.state.revision;
    const noOp = run(pwd.session, fixture, "mv /home/user/Downloads/Temporary /home/user/Downloads/Temporary");

    expect(movedCwd.execution?.exitCode).toBe(0);
    expect(movedCwd.session.cwdNodeId).toBe(cwdBefore);
    expect(outputText(pwd)).toBe("/home/user/Downloads/Temporary");
    expect(noOp.execution?.exitCode).toBe(0);
    expect(fixture.state.revision).toBe(samePathRevision);
  });

  it("moves nodes to Trash with metadata and keeps trashed cwd valid", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "mkdir Work").session;
    session = run(session, fixture, "cd Work").session;
    const trashed = run(session, fixture, "trash /home/user/Documents/Work");
    session = trashed.session;
    const pwd = run(session, fixture, "pwd");
    const trashList = run(pwd.session, fixture, "ls /home/user/.local/share/Trash/files");
    const trashDirectory = resolveVfsPath(fixture.state, "/home/user/.local/share/Trash/files");
    const entryNode = resolveVfsPath(fixture.state, "/home/user/.local/share/Trash/files/Work");
    const protectedNode = run(trashList.session, fixture, "trash /home/user/Documents");
    const alreadyTrash = run(protectedNode.session, fixture, "trash /home/user/.local/share/Trash/files/Work");

    expect(trashed.execution?.exitCode).toBe(0);
    expect(outputText(pwd)).toBe("/home/user/.local/share/Trash/files/Work");
    expect(outputText(trashList)).toBe("Work/");
    expect(trashDirectory.ok && trashDirectory.value.kind === "directory" ? trashDirectory.value.childIds : []).toHaveLength(1);
    expect(entryNode.ok ? fixture.state.trashEntriesByNodeId[entryNode.value.id]?.originalName : null).toBe("Work");
    expect(protectedNode.execution?.exitCode).toBe(1);
    expect(outputText(protectedNode)).toBe("trash: operation not permitted: /home/user/Documents");
    expect(alreadyTrash.execution?.exitCode).toBe(1);
    expect(outputText(alreadyTrash)).toBe("trash: already in Trash: /home/user/.local/share/Trash/files/Work");
  });

  it("rejects unsupported cp/mv options, Trash transfer targets, and trailing missing directories", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    const option = run(session, fixture, "cp -r Documents Downloads");
    session = option.session;
    const missingDirectory = run(session, fixture, "cp Documents/Welcome.md Downloads/Missing/");
    session = missingDirectory.session;
    const trashDestination = run(session, fixture, "cp Documents/Welcome.md /home/user/.local/share/Trash/files");
    session = trashDestination.session;
    const moveProtected = run(session, fixture, "mv Documents Downloads/Documents");

    expect(option.execution?.exitCode).toBe(2);
    expect(outputText(option)).toBe("cp: unsupported option: -r");
    expect(missingDirectory.execution?.exitCode).toBe(1);
    expect(outputText(missingDirectory)).toBe("cp: no such file or directory: Downloads/Missing/");
    expect(trashDestination.execution?.exitCode).toBe(1);
    expect(outputText(trashDestination)).toBe("cp: invalid destination: /home/user/.local/share/Trash/files");
    expect(moveProtected.execution?.exitCode).toBe(1);
    expect(outputText(moveProtected)).toBe("mv: operation not permitted: Downloads/Documents");
  });

  it("uses the latest mutable VFS state for consecutive shell mutations", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    const first = run(session, fixture, "mkdir A");
    session = first.session;
    const second = run(session, fixture, "mkdir B");
    const a = resolveVfsPath(fixture.state, "/home/user/A");
    const b = resolveVfsPath(fixture.state, "/home/user/B");

    expect(first.execution?.exitCode).toBe(0);
    expect(second.execution?.exitCode).toBe(0);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(fixture.state.revision).toBe(2);
    expect(second.session.commandHistory).toEqual(["mkdir A", "mkdir B"]);
    expect(second.session.transcript).toHaveLength(2);
  });

  it("keeps ShellError cause information for VFS failures", () => {
    const fixture = createMutableShellVfs();
    const session = createInitialShellSession(fixture.state);
    const result = run(session, fixture, "mv Missing Downloads");

    expect(result.execution?.exitCode).toBe(1);
    expect(result.session.transcript[0]?.output[0]?.stream).toBe("stderr");
    expect(outputText(result)).toBe("mv: no such file or directory: Missing");
  });
});
