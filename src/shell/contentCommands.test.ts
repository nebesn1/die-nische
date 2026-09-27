import { describe, expect, it, vi } from "vitest";
import { appendVfsTextFile, createVfsTextFile, moveVfsNodeToTrash } from "../vfs/mutations";
import { createInitialVfsState } from "../vfs/initialState";
import { readVfsTextFile, resolveVfsPath } from "../vfs/queries";
import { createVfsOperations } from "../vfs/vfsOperations";
import type { VfsState } from "../vfs/types";
import { executeShellInput } from "./execution";
import { createInitialShellSession } from "./session";
import type { ShellInputExecutionResult, ShellMutationPort, ShellSessionState } from "./types";

const fixedNow = "2003-04-06T12:30:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): VfsState => {
  if (!result.ok) {
    throw new Error("fixture mutation failed");
  }

  return result.state;
};

const outputText = (result: ShellInputExecutionResult): string =>
  result.execution?.output.map((chunk) => chunk.text).join("\n") ?? "";

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
  now: () => string = () => fixedNow,
): ShellInputExecutionResult =>
  executeShellInput(session, fixture.state, input, {
    mutations: fixture.mutations,
    now,
  });

describe("Shell echo command", () => {
  it("prints literal text with a trailing LF and never mutates VFS", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    const revision = fixture.state.revision;
    const empty = run(session, fixture, "echo");
    session = empty.session;
    const words = run(session, fixture, "echo Hello world");
    session = words.session;
    const quoted = run(session, fixture, 'echo "Hello   world"');
    session = quoted.session;
    const dash = run(session, fixture, "echo -n");
    const redirect = run(dash.session, fixture, "echo Hello > File.txt");

    expect(outputText(empty)).toBe("\n");
    expect(outputText(words)).toBe("Hello world\n");
    expect(outputText(quoted)).toBe("Hello   world\n");
    expect(outputText(dash)).toBe("-n\n");
    expect(redirect.execution?.exitCode).toBe(2);
    expect(outputText(redirect)).toBe("Shell operators and command substitution are not supported.");
    expect(fixture.state.revision).toBe(revision);
  });
});

describe("Shell append command", () => {
  it("appends LF-terminated UTF-8 text through the mutation port", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "cd Documents").session;
    session = run(session, fixture, "touch Log.txt").session;
    session = run(session, fixture, "append Log.txt First").session;
    session = run(session, fixture, "append Log.txt Second").session;
    const content = run(session, fixture, "cat Log.txt");
    const file = readVfsTextFile(fixture.state, "/home/user/Documents/Log.txt");

    expect(outputText(content)).toBe("First\nSecond\n");
    expect(file.ok ? file.value.content.text : null).toBe("First\nSecond\n");
    expect(file.ok ? file.value.size : null).toBe(13);
    expect(file.ok ? file.value.modifiedAt : null).toBe(fixedNow);
    expect(content.session.commandHistory).toContain("append Log.txt Second");
  });

  it("preserves existing content exactly and appends quoted empty text as LF", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "NoNewline.txt", "First", { now: fixedNow }));
    const fixture = createMutableShellVfs(state);
    run(createInitialShellSession(fixture.state), fixture, 'append Documents/NoNewline.txt ""');
    const file = readVfsTextFile(fixture.state, "/home/user/Documents/NoNewline.txt");

    expect(file.ok ? file.value.content.text : null).toBe("First\n");
  });

  it("uses the latest Provider state for rapid consecutive appends", () => {
    const fixture = createMutableShellVfs();
    let session = createInitialShellSession(fixture.state);
    session = run(session, fixture, "touch Rapid.txt").session;
    session = run(session, fixture, "append Rapid.txt A").session;
    session = run(session, fixture, "append Rapid.txt B").session;
    session = run(session, fixture, "append Rapid.txt C").session;
    const content = run(session, fixture, "cat Rapid.txt");

    expect(outputText(content)).toBe("A\nB\nC\n");
    expect(content.session.transcript.map((entry) => entry.input)).toEqual([
      "touch Rapid.txt",
      "append Rapid.txt A",
      "append Rapid.txt B",
      "append Rapid.txt C",
      "cat Rapid.txt",
    ]);
  });

  it("reports append usage, missing files, directories, Trash read-only, and missing mutation ports", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "TrashRead.txt", "old\n", { now: fixedNow }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/TrashRead.txt", { now: fixedNow }));
    const fixture = createMutableShellVfs(state);
    const session = createInitialShellSession(fixture.state);
    const missingText = run(session, fixture, "append Documents/Welcome.md");
    const missing = run(missingText.session, fixture, "append Missing.txt Text");
    const directory = run(missing.session, fixture, "append Documents Text");
    const trash = run(directory.session, fixture, "append /home/user/.local/share/Trash/files/TrashRead.txt Text");
    const clock = vi.fn(() => fixedNow);
    const noPort = executeShellInput(trash.session, fixture.state, "append Documents/Welcome.md Text", {
      now: clock,
    });

    expect(missingText.execution?.exitCode).toBe(2);
    expect(outputText(missing)).toBe("append: no such file: Missing.txt");
    expect(outputText(directory)).toBe("append: is a directory: Documents");
    expect(outputText(trash)).toBe("append: files in the Trash are read-only: /home/user/.local/share/Trash/files/TrashRead.txt");
    expect(noPort.execution?.exitCode).toBe(1);
    expect(outputText(noPort)).toBe("shell: write operations are not available in this session");
    expect(clock).not.toHaveBeenCalled();
  });
});

describe("Shell head and tail commands", () => {
  it("selects default and explicit LF-delimited lines without adding newlines", () => {
    let state = createInitialVfsState();
    state = expectMutation(
      createVfsTextFile(
        state,
        "/home/user/Documents",
        "Lines.txt",
        Array.from({ length: 12 }, (_, index) => `Line ${index + 1}\n`).join(""),
        { now: fixedNow },
      ),
    );
    const fixture = createMutableShellVfs(state);
    const session = createInitialShellSession(fixture.state);
    const head = run(session, fixture, "head Documents/Lines.txt");
    const tail = run(head.session, fixture, "tail Documents/Lines.txt");
    const headThree = run(tail.session, fixture, "head -n 3 Documents/Lines.txt");
    const tailThree = run(headThree.session, fixture, "tail -n 3 Documents/Lines.txt");
    const zero = run(tailThree.session, fixture, "head -n 0 Documents/Lines.txt");

    expect(outputText(head)).toBe(Array.from({ length: 10 }, (_, index) => `Line ${index + 1}\n`).join(""));
    expect(outputText(tail)).toBe(Array.from({ length: 10 }, (_, index) => `Line ${index + 3}\n`).join(""));
    expect(outputText(headThree)).toBe("Line 1\nLine 2\nLine 3\n");
    expect(outputText(tailThree)).toBe("Line 10\nLine 11\nLine 12\n");
    expect(zero.execution?.output).toEqual([]);
  });

  it("preserves CRLF, lone CR, empty lines, missing trailing newlines, and UTF-8", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Mixed.txt", "一\r\n\r二\r三", { now: fixedNow }));
    const fixture = createMutableShellVfs(state);
    const session = createInitialShellSession(fixture.state);
    const head = run(session, fixture, "head -n 3 Documents/Mixed.txt");
    const tail = run(head.session, fixture, "tail -n 2 Documents/Mixed.txt");

    expect(outputText(head)).toBe("一\r\n\r二\r");
    expect(outputText(tail)).toBe("二\r三");
  });

  it("reads Trash files and rejects invalid arguments without mutating revision", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "TrashLines.txt", "a\nb\n", { now: fixedNow }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/TrashLines.txt", { now: fixedNow }));
    const revision = state.revision;
    const fixture = createMutableShellVfs(state);
    const session = createInitialShellSession(fixture.state);
    const trash = run(session, fixture, "tail -n 1 /home/user/.local/share/Trash/files/TrashLines.txt");
    const missing = run(trash.session, fixture, "head Missing.txt");
    const directory = run(missing.session, fixture, "tail Documents");
    const invalid = run(directory.session, fixture, "head -n 1.5 Documents/Welcome.md");
    const option = run(invalid.session, fixture, "tail -x Documents/Welcome.md");

    expect(outputText(trash)).toBe("b\n");
    expect(outputText(missing)).toBe("head: no such file: Missing.txt");
    expect(outputText(directory)).toBe("tail: is a directory: Documents");
    expect(invalid.execution?.exitCode).toBe(2);
    expect(outputText(invalid)).toBe("head: invalid line count: 1.5");
    expect(outputText(option)).toBe("tail: unsupported option: -x");
    expect(resolveVfsPath(fixture.state, "/home/user/.local/share/Trash/files/TrashLines.txt").ok).toBe(true);
    expect(fixture.state.revision).toBe(revision);
  });
});

describe("VFS append integration", () => {
  it("keeps empty low-level append as a no-op and appends CRLF text", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Atomic.txt", "A", { now: fixedNow }));
    const before = state;
    const empty = appendVfsTextFile(state, "/home/user/Documents/Atomic.txt", "", { now: fixedNow });
    state = expectMutation(appendVfsTextFile(state, "/home/user/Documents/Atomic.txt", "\r\nB", { now: fixedNow }));
    const file = readVfsTextFile(state, "/home/user/Documents/Atomic.txt");

    expect(empty).toMatchObject({ ok: true, state: before });
    expect(file.ok ? file.value.content.text : null).toBe("A\r\nB");
  });
});
