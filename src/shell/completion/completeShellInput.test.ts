import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile, moveVfsNodeToTrash, renameVfsNode } from "../../vfs/mutations";
import type { VfsState } from "../../vfs/types";
import { executeShellInput } from "../execution";
import { createInitialShellSession } from "../session";
import type { ShellSessionState } from "../types";
import { completeShellInput } from "./completeShellInput";

const now = "2026-08-04T00:00:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): VfsState => {
  if (!result.ok) {
    throw new Error("fixture mutation failed");
  }

  return result.state;
};

const complete = (session: ShellSessionState, state: VfsState, draft: string, cursor = draft.length) =>
  completeShellInput(session, state, draft, cursor);

describe("completeShellInput command completion", () => {
  it("returns fixed command-order candidates for empty input and command prefixes", () => {
    const state = createInitialVfsState();
    const session = createInitialShellSession(state);
    const empty = complete(session, state, "");
    const c = complete(session, state, "c");

    expect(empty.candidates.map((candidate) => candidate.displayText)).toEqual([
      "pwd",
      "cd",
      "ls",
      "cat",
      "echo",
      "append",
      "head",
      "tail",
      "wc",
      "grep",
      "find",
      "stat",
      "basename",
      "dirname",
      "tree",
      "mkdir",
      "touch",
      "cp",
      "mv",
      "trash",
      "restore",
      "permanent-delete",
      "empty-trash",
      "history",
      "clear",
      "help",
    ]);
    expect(empty.changed).toBe(false);
    expect(c.candidates.map((candidate) => candidate.displayText)).toEqual(["cd", "cat", "cp", "clear"]);
    expect(c.draft).toBe("c");
  });

  it("completes unique command names with a trailing space and remains case-sensitive", () => {
    const state = createInitialVfsState();
    const session = createInitialShellSession(state);
    const cat = complete(session, state, "ca");
    const upper = complete(session, state, "PWD");

    expect(cat.draft).toBe("cat ");
    expect(cat.cursorPosition).toBe(4);
    expect(cat.candidates).toHaveLength(1);
    expect(upper.candidates).toEqual([]);
  });

  it("completes help topics without requiring VFS path completion", () => {
    const state = createInitialVfsState();
    const session = createInitialShellSession(state);
    const multiple = complete(session, state, "help c");
    const unique = complete(session, state, "help mk");
    const permanent = complete(session, state, "help per");
    const extra = complete(session, state, "help cd x");

    expect(multiple.candidates.map((candidate) => candidate.displayText)).toEqual(["cd", "cat", "cp", "clear"]);
    expect(unique.draft).toBe("help mkdir");
    expect(permanent.draft).toBe("help permanent-delete");
    expect(extra.candidates).toEqual([]);
    expect(complete(session, state, "help app").draft).toBe("help append");
    expect(complete(session, state, "help hea").draft).toBe("help head");
    expect(complete(session, state, "help wc").draft).toBe("help wc");
    expect(complete(session, state, "help gre").draft).toBe("help grep");
    expect(complete(session, state, "help fin").draft).toBe("help find");
    expect(complete(session, state, "help sta").draft).toBe("help stat");
    expect(complete(session, state, "help bas").draft).toBe("help basename");
    expect(complete(session, state, "help dirn").draft).toBe("help dirname");
    expect(complete(session, state, "help tre").draft).toBe("help tree");
    expect(complete(session, state, "help his").draft).toBe("help history");
  });
});

describe("completeShellInput path completion", () => {
  it("filters paths by command context and appends directory slash or file space", () => {
    const state = createInitialVfsState();
    const session = createInitialShellSession(state);
    const cdEmpty = complete(session, state, "cd ");
    const cd = complete(session, state, "cd Doc");
    const cat = complete(session, state, "cat Documents/Wel");
    const ls = complete(session, state, "ls Documents/Wel");

    expect(cdEmpty.draft).toBe("cd ");
    expect(cdEmpty.cursorPosition).toBe(3);
    expect(cdEmpty.changed).toBe(false);
    expect(cdEmpty.candidates.map((candidate) => candidate.displayText)).toEqual([
      "Desktop/",
      "Documents/",
      "Downloads/",
      "Music/",
      "Pictures/",
      "Videos/",
      ".local/",
    ]);
    expect(cd.draft).toBe("cd Documents/");
    expect(cd.candidates[0]).toMatchObject({ displayText: "Documents/", kind: "directory" });
    expect(cat.draft).toBe("cat Documents/Welcome.md ");
    expect(cat.candidates[0]).toMatchObject({ displayText: "Welcome.md", kind: "file" });
    expect(ls.draft).toBe("ls Documents/Welcome.md ");
  });

  it("supports absolute, relative, dot, dot-dot, root, hidden, and Trash paths in child order", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", ".hidden", "", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Notes.txt", { now }));
    let session = createInitialShellSession(state);
    session = executeShellInput(session, state, "cd Documents").session;

    expect(complete(session, state, "ls ../Down").draft).toBe("ls ../Downloads/");
    expect(complete(session, state, "ls ./Wel").draft).toBe("ls ./Welcome.md ");
    expect(complete(session, state, "ls /home/user/Doc").draft).toBe("ls /home/user/Documents/");
    expect(complete(session, state, "ls /").candidates.map((candidate) => candidate.displayText)).toEqual([
      "home/",
      "media/",
    ]);
    expect(complete(session, state, "cat .h").draft).toBe("cat .hidden ");
    expect(complete(session, state, "ls /home/user/.local/share/Trash/files/N").draft).toBe("ls /home/user/.local/share/Trash/files/Notes.txt ");
  });

  it("returns empty candidates for missing parents, file parents, tildes, and invalid contexts without changing VFS", () => {
    const state = createInitialVfsState();
    const revision = state.revision;
    const session = createInitialShellSession(state);

    expect(complete(session, state, "cat Missing/No").candidates).toEqual([]);
    expect(complete(session, state, "cat Documents/Welcome.md/No").candidates).toEqual([]);
    expect(complete(session, state, "cat ~").candidates).toEqual([]);
    expect(complete(session, state, "pwd Doc").candidates).toEqual([]);
    expect(state.revision).toBe(revision);
  });

  it("completes file operands for append, head, and tail with their command-specific contexts", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Log.txt", "", { now }));
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "Reports", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "TrashLog.txt", "", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/TrashLog.txt", { now }));
    const session = createInitialShellSession(state);

    expect(complete(session, state, "append Documents/Lo").draft).toBe("append Documents/Log.txt ");
    expect(complete(session, state, "append Documents/Re").candidates).toEqual([]);
    expect(complete(session, state, "append /home/user/.local/share/Trash/files/Tr").candidates).toEqual([]);
    expect(complete(session, state, "append Documents/Log.txt Te").candidates).toEqual([]);
    expect(complete(session, state, "head Documents/Lo").draft).toBe("head Documents/Log.txt ");
    expect(complete(session, state, "tail Documents/Lo").draft).toBe("tail Documents/Log.txt ");
    expect(complete(session, state, "head -n 5 Documents/Lo").draft).toBe("head -n 5 Documents/Log.txt ");
    expect(complete(session, state, "tail -n 5 Documents/Lo").draft).toBe("tail -n 5 Documents/Log.txt ");
    expect(complete(session, state, "head -n 5").candidates).toEqual([]);
    expect(complete(session, state, "tail -n 5").candidates).toEqual([]);
    expect(complete(session, state, "head /home/user/.local/share/Trash/files/Tr").draft).toBe("head /home/user/.local/share/Trash/files/TrashLog.txt ");
  });

  it("completes wc and grep file operands and find file or directory starts", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Search.txt", "", { now }));
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "SearchDir", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "TrashSearch.txt", "", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/TrashSearch.txt", { now }));
    const session = createInitialShellSession(state);
    const revision = state.revision;

    expect(complete(session, state, "wc Documents/Sear").draft).toBe("wc Documents/Search.txt ");
    expect(complete(session, state, "wc -l Documents/Sear").draft).toBe("wc -l Documents/Search.txt ");
    expect(complete(session, state, "wc -w Documents/Sear").draft).toBe("wc -w Documents/Search.txt ");
    expect(complete(session, state, "wc -c /home/user/.local/share/Trash/files/TrashS").draft).toBe("wc -c /home/user/.local/share/Trash/files/TrashSearch.txt ");
    expect(complete(session, state, "grep needle Documents/Sear").draft).toBe("grep needle Documents/Search.txt ");
    expect(complete(session, state, "grep -i -n needle Documents/Sear").draft).toBe("grep -i -n needle Documents/Search.txt ");
    expect(complete(session, state, "grep nee").candidates).toEqual([]);
    expect(complete(session, state, "find Documents/Search").candidates.map((candidate) => candidate.displayText)).toEqual([
      "Search.txt",
      "SearchDir/",
    ]);
    expect(complete(session, state, "find -name Sear").candidates).toEqual([]);
    expect(complete(session, state, "find Documents -name Sear").candidates).toEqual([]);
    expect(state.revision).toBe(revision);
  });

  it("completes stat, basename, dirname, and tree paths from the latest VFS state", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Inspect.txt", "", { now }));
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "InspectDir", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Inspect.txt", { now }));
    const session = createInitialShellSession(state);
    const revision = state.revision;

    expect(complete(session, state, "stat Documents/Ins").draft).toBe("stat Documents/InspectDir/");
    expect(complete(session, state, "basename Documents/Ins").draft).toBe("basename Documents/InspectDir/");
    expect(complete(session, state, "dirname Documents/Ins").draft).toBe("dirname Documents/InspectDir/");
    expect(complete(session, state, "tree Documents/Ins").draft).toBe("tree Documents/InspectDir/");
    expect(complete(session, state, "stat /home/user/.local/share/Trash/files/Ins").draft).toBe("stat /home/user/.local/share/Trash/files/Inspect.txt ");
    expect(complete(session, state, "tree Documents/InspectDir extra").candidates).toEqual([]);
    expect(complete(session, state, "basename Documents/InspectDir suffix").candidates).toEqual([]);
    expect(state.revision).toBe(revision);
  });

  it("does not offer path or count candidates for history", () => {
    const state = createInitialVfsState();
    const session = createInitialShellSession(state);

    expect(complete(session, state, "history ").candidates).toEqual([]);
    expect(complete(session, state, "history 2").candidates).toEqual([]);
  });
});

describe("completeShellInput quoting and multiple candidates", () => {
  it("escapes unquoted names and keeps quoted names as editable text", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user", "Current Tasks.txt", "", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user", 'Quote "Name".txt', "", { now }));
    const session = createInitialShellSession(state);

    expect(complete(session, state, "cat Current").draft).toBe(String.raw`cat Current\ Tasks.txt `);
    expect(complete(session, state, 'cat "Current').draft).toBe('cat "Current Tasks.txt');
    expect(complete(session, state, 'cat "Quote').draft).toBe('cat "Quote \\"Name\\".txt');
  });

  it("skips single-quote candidates that cannot be represented safely", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user", "Bob's.txt", "", { now }));
    const session = createInitialShellSession(state);

    expect(complete(session, state, "cat 'Bob").candidates).toEqual([]);
  });

  it("extends a longest common prefix for multiple candidates and then only displays candidates", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user", "Test One.txt", "", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user", "Test Two.txt", "", { now }));
    const session = createInitialShellSession(state);
    const first = complete(session, state, "cat Test");
    const second = complete(session, state, first.draft, first.cursorPosition);
    const third = complete(session, state, first.draft, first.cursorPosition);

    expect(first.draft).toBe(String.raw`cat Test\ `);
    expect(first.candidates.map((candidate) => candidate.displayText)).toEqual(["Test One.txt", "Test Two.txt"]);
    expect(second.draft).toBe(first.draft);
    expect(second.changed).toBe(false);
    expect(third.contextKey).toBe(second.contextKey);
  });

  it("preserves text after the cursor when completing in the middle of an input", () => {
    const state = createInitialVfsState();
    const session = createInitialShellSession(state);
    const draft = "cat Documents/Wel && later";
    const cursor = "cat Documents/Wel".length;
    const result = complete(session, state, draft, cursor);

    expect(result.draft).toBe("cat Documents/Welcome.md  && later");
    expect(result.cursorPosition).toBe("cat Documents/Welcome.md ".length);
  });

  it("uses the latest VFS state instead of caching prior candidates", () => {
    let state = createInitialVfsState();
    const session = createInitialShellSession(state);

    expect(complete(session, state, "cat Documents/Draft").candidates).toEqual([]);

    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Draft.txt", "", { now }));
    expect(complete(session, state, "cat Documents/Dra").draft).toBe("cat Documents/Draft.txt ");

    state = expectMutation(renameVfsNode(state, "/home/user/Documents/Draft.txt", "Final.txt", { now }));
    expect(complete(session, state, "cat Documents/Dra").candidates).toEqual([]);
    expect(complete(session, state, "cat Documents/Fi").draft).toBe("cat Documents/Final.txt ");
  });

  it("completes restore and permanent-delete operands from top-level Trash entries only", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "Project", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/Project", "Plan.txt", "", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Current Tasks.txt", "", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Project", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/Current Tasks.txt", { now }));
    let session = createInitialShellSession(state);
    const restoreAbsolute = complete(session, state, "restore /home/user/.local/share/Trash/files/Pro");
    const deleteConfirmed = complete(session, state, "permanent-delete --confirm /home/user/.local/share/Trash/files/Cur");
    const noOptionCompletion = complete(session, state, "permanent-delete --c");
    const nested = complete(session, state, "restore /home/user/.local/share/Trash/files/Project/Pl");

    session = executeShellInput(session, state, "cd /home/user/.local/share/Trash/files").session;
    const restoreRelative = complete(session, state, "restore Pro");

    expect(restoreAbsolute.draft).toBe("restore /home/user/.local/share/Trash/files/Project ");
    expect(restoreAbsolute.candidates[0]).toMatchObject({
      displayText: "Project/",
      kind: "directory",
    });
    expect(deleteConfirmed.draft).toBe(String.raw`permanent-delete --confirm /home/user/.local/share/Trash/files/Current\ Tasks.txt `);
    expect(noOptionCompletion.candidates).toEqual([]);
    expect(nested.candidates).toEqual([]);
    expect(restoreRelative.draft).toBe("restore Project ");
  });
});
