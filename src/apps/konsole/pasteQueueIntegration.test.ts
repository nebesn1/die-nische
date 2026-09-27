import { describe, expect, it } from "vitest";
import { createInitialShellSession } from "../../shell";
import { createInitialVfsState } from "../../vfs/initialState";
import { readVfsTextFile, resolveVfsPath } from "../../vfs/queries";
import { createVfsOperations } from "../../vfs/vfsOperations";
import type { VfsState } from "../../vfs/types";
import type { ShellMutationPort, ShellSessionState } from "../../shell";
import { enqueueKonsoleCommands, consumeKonsoleQueuedCommand, initialKonsolePasteQueueState } from "./pasteQueue";
import { planKonsolePaste } from "./multiLinePaste";
import { submitKonsoleShellInput } from "./submission";

const now = "2003-04-06T12:30:00.000Z";

const createMutableVfs = () => {
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
    mutations,
  };
};

const processQueuedCommands = (inputs: readonly string[]) => {
  const fixture = createMutableVfs();
  let queue = enqueueKonsoleCommands(initialKonsolePasteQueueState, inputs);
  let session: ShellSessionState = createInitialShellSession(fixture.state);

  while (queue.items[0]) {
    const item = queue.items[0];
    const result = submitKonsoleShellInput(session, fixture.state, item.input, {
      mutations: fixture.mutations,
      now: () => now,
    });
    session = result.session;
    queue = consumeKonsoleQueuedCommand(queue, item.id);
  }

  return { fixture, session, queue };
};

describe("Konsole sequential paste queue integration", () => {
  it("uses each prior session and latest VFS state for dependent mutation commands", () => {
    const result = processQueuedCommands([
      "cd Documents",
      "mkdir Batch",
      "cd Batch",
      "touch Notes.txt",
      "append Notes.txt First",
      "append Notes.txt Second",
      "cat Notes.txt",
    ]);
    const file = readVfsTextFile(result.fixture.state, "/home/user/Documents/Batch/Notes.txt");
    const batchDirectory = resolveVfsPath(result.fixture.state, "/home/user/Documents/Batch");

    expect(result.session.cwdNodeId).toBe(batchDirectory.ok ? batchDirectory.value.id : null);
    expect(file.ok ? file.value.content.text : null).toBe("First\nSecond\n");
    expect(result.session.transcript.at(-1)?.output[0]?.text).toBe("First\nSecond\n");
    expect(result.session.commandHistory).toEqual([
      "cd Documents", "mkdir Batch", "cd Batch", "touch Notes.txt", "append Notes.txt First", "append Notes.txt Second", "cat Notes.txt",
    ]);
    expect(result.queue.items).toEqual([]);
  });

  it("continues after failures, commits pasted blank prompt lines, and honors clear", () => {
    const result = processQueuedCommands(["cd Missing", "", "pwd", "clear", "echo after"]);

    expect(result.session.transcript.map((entry) => entry.input)).toEqual(["echo after"]);
    expect(result.session.commandHistory).toEqual(["cd Missing", "pwd", "clear", "echo after"]);
    expect(result.session.transcript[0]?.output[0]?.text).toBe("after\n");
  });

  it("commits each pasted blank physical line without adding history entries", () => {
    const result = processQueuedCommands(["echo A", "", "echo B"]);

    expect(result.session.transcript.map((entry) => entry.input)).toEqual(["echo A", "", "echo B"]);
    expect(result.session.transcript[1]).toMatchObject({ cwdPath: "/home/user", output: [], exitCode: 0 });
    expect(result.session.commandHistory).toEqual(["echo A", "echo B"]);
  });

  it("distinguishes a single trailing terminator from a second blank physical line", () => {
    const singleTerminator = planKonsolePaste("", 0, 0, "pwd\n");
    const doubleTerminator = planKonsolePaste("", 0, 0, "pwd\n\n");
    const singleResult = processQueuedCommands(singleTerminator.commands);
    const doubleResult = processQueuedCommands(doubleTerminator.commands);

    expect(singleTerminator.commands).toEqual(["pwd"]);
    expect(singleResult.session.transcript.map((entry) => entry.input)).toEqual(["pwd"]);
    expect(doubleTerminator.commands).toEqual(["pwd", ""]);
    expect(doubleResult.session.transcript.map((entry) => entry.input)).toEqual(["pwd", ""]);
    expect(doubleResult.session.commandHistory).toEqual(["pwd"]);
  });

  it("handles Trash dependency commands in FIFO order", () => {
    const result = processQueuedCommands([
      "cd Documents",
      "mkdir PasteTrash",
      "touch PasteTrash/A.txt",
      "trash PasteTrash",
      "ls /home/user/.local/share/Trash/files",
      "restore /home/user/.local/share/Trash/files/PasteTrash",
      "ls",
    ]);

    expect(resolveVfsPath(result.fixture.state, "/home/user/Documents/PasteTrash/A.txt").ok).toBe(true);
    expect(resolveVfsPath(result.fixture.state, "/home/user/.local/share/Trash/files/PasteTrash").ok).toBe(false);
    expect(result.session.transcript).toHaveLength(7);
  });

  it("lets sequential pasted tree and stat commands observe the latest Provider state", () => {
    const treeResult = processQueuedCommands(["cd Documents", "mkdir TreeBatch", "touch TreeBatch/A.txt", "tree TreeBatch"]);
    const statResult = processQueuedCommands(["cd Documents", "touch MetaBatch.txt", "append MetaBatch.txt Hello", "stat MetaBatch.txt"]);

    expect(treeResult.session.transcript.at(-1)?.output[0]?.text).toBe(
      "/home/user/Documents/TreeBatch\n`-- A.txt\n",
    );
    expect(statResult.session.transcript.at(-1)?.output[0]?.text).toContain("Size: 6 bytes");
    expect(statResult.session.transcript.at(-1)?.output[0]?.text).toContain(`Modified: ${now}`);
  });

  it("lets pasted history observe prior queued commands while omitting blank lines and itself", () => {
    const result = processQueuedCommands(["echo PasteOne", "", "echo PasteTwo", "history"]);

    expect(result.session.transcript.at(-1)?.output[0]?.text).toBe("1  echo PasteOne\n2  echo PasteTwo\n");
    expect(result.session.commandHistory).toEqual(["echo PasteOne", "echo PasteTwo", "history"]);
  });
});
