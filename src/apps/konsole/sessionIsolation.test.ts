import { describe, expect, it } from "vitest";
import { executeShellInput, createInitialShellSession, type ShellMutationPort, type ShellSessionState } from "../../shell";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsOperations } from "../../vfs/vfsOperations";
import type { VfsState } from "../../vfs/types";

const now = "2003-04-06T12:30:00.000Z";

const outputText = (result: ReturnType<typeof executeShellInput>): string =>
  result.execution?.output.map((chunk) => chunk.text).join("\n") ?? "";

const createSharedVfs = () => {
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

const run = (session: ShellSessionState, fixture: ReturnType<typeof createSharedVfs>, input: string) =>
  executeShellInput(session, fixture.state, input, { mutations: fixture.mutations, now: () => now });

describe("Konsole session isolation", () => {
  it("keeps cwd, transcript, command history, and fresh-session defaults independent", () => {
    const fixture = createSharedVfs();
    const fresh = createInitialShellSession(fixture.state);
    let first = createInitialShellSession(fixture.state);
    let second = createInitialShellSession(fixture.state);

    first = run(first, fixture, "cd Documents").session;
    second = run(second, fixture, "cd Downloads").session;
    const firstPwd = run(first, fixture, "pwd");
    const secondPwd = run(second, fixture, "pwd");
    first = firstPwd.session;
    second = secondPwd.session;

    expect(fresh).toMatchObject({ cwdNodeId: fixture.state.specialLocations.home, transcript: [], commandHistory: [] });
    expect(outputText(firstPwd)).toBe("/home/user/Documents");
    expect(outputText(secondPwd)).toBe("/home/user/Downloads");
    expect(first.commandHistory).toEqual(["cd Documents", "pwd"]);
    expect(second.commandHistory).toEqual(["cd Downloads", "pwd"]);
    expect(first.transcript).not.toBe(second.transcript);
    expect(first.commandHistory).not.toBe(second.commandHistory);
  });

  it("uses the shared VFS while retaining each terminal's exact relative cwd", () => {
    const fixture = createSharedVfs();
    let first = run(createInitialShellSession(fixture.state), fixture, "cd Documents").session;
    let second = run(createInitialShellSession(fixture.state), fixture, "cd Downloads").session;

    first = run(first, fixture, "touch SharedFromFirst.txt").session;
    const firstList = run(first, fixture, "ls .");
    const secondList = run(second, fixture, "ls .");
    second = secondList.session;
    const secondReadsFirst = run(second, fixture, "ls ../Documents");
    second = secondReadsFirst.session;

    expect(outputText(firstList)).toContain("SharedFromFirst.txt");
    expect(outputText(secondList)).toBe("");
    expect(outputText(secondReadsFirst)).toContain("SharedFromFirst.txt");
    expect(first.cwdNodeId).not.toBe(second.cwdNodeId);
    expect(second.commandHistory).toEqual(["cd Downloads", "ls .", "ls ../Documents"]);
  });

  it("starts an explicitly initialized session at its requested cwd for pwd and cd", () => {
    const fixture = createSharedVfs();
    const initial = createInitialShellSession(fixture.state, "/home/user/Documents");
    const pwd = run(initial, fixture, "pwd");
    const parent = run(pwd.session, fixture, "cd ..");

    expect(outputText(pwd)).toBe("/home/user/Documents");
    expect(outputText(run(parent.session, fixture, "pwd"))).toBe("/home/user");
  });
});
