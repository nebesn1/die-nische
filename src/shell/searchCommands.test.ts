import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../vfs/initialState";
import { createVfsDirectory, createVfsTextFile, moveVfsNodeToTrash, renameVfsNode } from "../vfs/mutations";
import { resolveVfsPath } from "../vfs/queries";
import type { VfsDirectoryNode, VfsState } from "../vfs/types";
import { executeShellInput } from "./execution";
import { parseShellFindArguments } from "./findArguments";
import { parseShellGrepArguments } from "./grepArguments";
import { createInitialShellSession } from "./session";
import { countShellText } from "./textInspection";
import { splitPreservedLineEnding } from "./textLines";
import type { ShellInputExecutionResult, ShellSessionState } from "./types";
import { walkVfsTree } from "./vfsTraversal";
import { parseShellWcArguments } from "./wcArguments";

const now = "2003-04-06T12:30:00.000Z";
const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): VfsState => {
  if (!result.ok) throw new Error("fixture mutation failed");
  return result.state;
};
const run = (session: ShellSessionState, state: VfsState, input: string): ShellInputExecutionResult => executeShellInput(session, state, input);
const outputText = (result: ShellInputExecutionResult): string => result.execution?.output.map((chunk) => chunk.text).join("") ?? "";

describe("Shell text inspection helpers", () => {
  it("counts logical lines, whitespace-delimited words, and UTF-8 bytes", () => {
    expect(countShellText("")).toEqual({ lines: 0, words: 0, bytes: 0 });
    expect(countShellText("abc")).toEqual({ lines: 1, words: 1, bytes: 3 });
    expect(countShellText("abc\n")).toEqual({ lines: 1, words: 1, bytes: 4 });
    expect(countShellText("a\r\nb\rc\n")).toEqual({ lines: 3, words: 3, bytes: 7 });
    expect(countShellText("  one\t two\n你好  ")).toEqual({ lines: 2, words: 3, bytes: 19 });
  });

  it("splits preserved endings without normalizing text", () => {
    expect(splitPreservedLineEnding("plain")).toEqual({ body: "plain", terminator: "" });
    expect(splitPreservedLineEnding("line\n")).toEqual({ body: "line", terminator: "\n" });
    expect(splitPreservedLineEnding("line\r\n")).toEqual({ body: "line", terminator: "\r\n" });
    expect(splitPreservedLineEnding("line\r")).toEqual({ body: "line", terminator: "\r" });
    expect(splitPreservedLineEnding("\n")).toEqual({ body: "", terminator: "\n" });
  });
});

describe("Shell search argument parsers", () => {
  it("parses wc modes and rejects unsupported options", () => {
    expect(parseShellWcArguments(["File.txt"])).toMatchObject({ ok: true, value: { mode: "all" } });
    expect(parseShellWcArguments(["-l", "File.txt"])).toMatchObject({ ok: true, value: { mode: "lines" } });
    expect(parseShellWcArguments(["-w", "File.txt"])).toMatchObject({ ok: true, value: { mode: "words" } });
    expect(parseShellWcArguments(["-c", "File.txt"])).toMatchObject({ ok: true, value: { mode: "bytes" } });
    expect(parseShellWcArguments(["-lw", "File.txt"])).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_OPTION" } });
    expect(parseShellWcArguments([])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT_COUNT" } });
  });

  it("parses grep options in either order and rejects duplicates", () => {
    expect(parseShellGrepArguments(["needle", "File.txt"])).toMatchObject({ ok: true, value: { ignoreCase: false, showLineNumbers: false } });
    expect(parseShellGrepArguments(["-i", "-n", "needle", "File.txt"])).toMatchObject({ ok: true, value: { ignoreCase: true, showLineNumbers: true } });
    expect(parseShellGrepArguments(["-n", "-i", "needle", "File.txt"])).toMatchObject({ ok: true });
    expect(parseShellGrepArguments(["-i", "-i", "x", "f"])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(parseShellGrepArguments(["-in", "x", "f"])).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_OPTION" } });
    expect(parseShellGrepArguments(["x"])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT_COUNT" } });
  });

  it("parses find start paths and literal name filters", () => {
    expect(parseShellFindArguments([])).toEqual({ ok: true, value: { startPath: ".", name: null } });
    expect(parseShellFindArguments(["Documents"])).toEqual({ ok: true, value: { startPath: "Documents", name: null } });
    expect(parseShellFindArguments(["-name", "Notes.txt"])).toEqual({ ok: true, value: { startPath: ".", name: "Notes.txt" } });
    expect(parseShellFindArguments(["Documents", "-name", "*.txt"])).toEqual({ ok: true, value: { startPath: "Documents", name: "*.txt" } });
    expect(parseShellFindArguments(["-type", "f"])).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_OPTION" } });
    expect(parseShellFindArguments(["Documents", "Other"])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT_COUNT" } });
  });
});

describe("Shell wc command", () => {
  it("prints default and selected counts with the canonical path", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Counts.txt", "one two\r\n三\rlast", { now }));
    const revision = state.revision;
    let session = createInitialShellSession(state);
    const all = run(session, state, "wc Documents/Counts.txt");
    session = all.session;
    const lines = run(session, state, "wc -l Documents/Counts.txt");
    const words = run(lines.session, state, "wc -w Documents/Counts.txt");
    const bytes = run(words.session, state, "wc -c Documents/Counts.txt");

    expect(outputText(all)).toBe("3 4 17 /home/user/Documents/Counts.txt\n");
    expect(outputText(lines)).toBe("3 /home/user/Documents/Counts.txt\n");
    expect(outputText(words)).toBe("4 /home/user/Documents/Counts.txt\n");
    expect(outputText(bytes)).toBe("17 /home/user/Documents/Counts.txt\n");
    expect(state.revision).toBe(revision);
  });

  it("reads Trash files and reports controlled errors", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "TrashCount.txt", "x\n", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/TrashCount.txt", { now }));
    const session = createInitialShellSession(state);
    expect(outputText(run(session, state, "wc -l /home/user/.local/share/Trash/files/TrashCount.txt"))).toBe("1 /home/user/.local/share/Trash/files/TrashCount.txt\n");
    expect(outputText(run(session, state, "wc Missing.txt"))).toBe("wc: no such file: Missing.txt");
    expect(outputText(run(session, state, "wc Documents"))).toBe("wc: is a directory: Documents");
    expect(run(session, state, "wc A B").execution?.exitCode).toBe(2);
  });
});

describe("Shell grep command", () => {
  it("matches literal substrings and preserves original endings", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Search.txt", "Apple\r\napple pie\ra.b\naxb\nlast", { now }));
    const revision = state.revision;
    const session = createInitialShellSession(state);
    expect(outputText(run(session, state, "grep apple Documents/Search.txt"))).toBe("apple pie\r");
    expect(outputText(run(session, state, "grep -i -n apple Documents/Search.txt"))).toBe("1:Apple\r\n2:apple pie\r");
    expect(outputText(run(session, state, 'grep "a.b" Documents/Search.txt'))).toBe("a.b\n");
    expect(outputText(run(session, state, 'grep "" Documents/Search.txt'))).toBe("Apple\r\napple pie\ra.b\naxb\nlast");
    expect(state.revision).toBe(revision);
  });

  it("distinguishes no matches from runtime and usage failures", () => {
    const state = createInitialVfsState();
    const session = createInitialShellSession(state);
    const noMatch = run(session, state, "grep Missing Documents/Welcome.md");
    expect(noMatch.execution).toMatchObject({ exitCode: 1, output: [] });
    expect(outputText(run(session, state, "grep x Missing.txt"))).toBe("grep: no such file: Missing.txt");
    expect(outputText(run(session, state, "grep x Documents"))).toBe("grep: is a directory: Documents");
    expect(run(session, state, "grep -i pattern").execution?.exitCode).toBe(2);
  });
});

describe("Shell find command and VFS traversal", () => {
  it("walks preorder and applies exact case-sensitive basename matching", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "Project", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/Project", "Notes.txt", "", { now }));
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents/Project", "Sub", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/Project/Sub", "Notes.txt", "", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/Project", "*.txt", "", { now }));
    const revision = state.revision;
    const session = createInitialShellSession(state);
    expect(outputText(run(session, state, "find Documents/Project"))).toBe([
      "/home/user/Documents/Project", "/home/user/Documents/Project/Notes.txt", "/home/user/Documents/Project/Sub",
      "/home/user/Documents/Project/Sub/Notes.txt", "/home/user/Documents/Project/*.txt", "",
    ].join("\n"));
    expect(outputText(run(session, state, "find Documents/Project -name Notes.txt"))).toBe("/home/user/Documents/Project/Notes.txt\n/home/user/Documents/Project/Sub/Notes.txt\n");
    expect(outputText(run(session, state, 'find Documents/Project -name "*.txt"'))).toBe("/home/user/Documents/Project/*.txt\n");
    expect(state.revision).toBe(revision);
  });

  it("supports file starts, no-match success, and Trash traversal", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "FindMe.txt", "", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/FindMe.txt", { now }));
    let session = createInitialShellSession(state);
    session = run(session, state, "cd /home/user/.local/share/Trash/files").session;
    expect(outputText(run(session, state, "find FindMe.txt"))).toBe("/home/user/.local/share/Trash/files/FindMe.txt\n");
    expect(run(session, state, "find . -name Missing").execution).toMatchObject({ exitCode: 0, output: [] });
    expect(outputText(run(session, state, "find /home/user/.local/share/Trash/files"))).toBe("/home/user/.local/share/Trash/files\n/home/user/.local/share/Trash/files/FindMe.txt\n");
  });

  it("uses a visited guard for repeated child references", () => {
    const initial = createInitialVfsState();
    const documents = resolveVfsPath(initial, "/home/user/Documents");
    if (!documents.ok || documents.value.kind !== "directory") throw new Error("Documents fixture missing");
    const corruptDirectory: VfsDirectoryNode = { ...documents.value, childIds: [...documents.value.childIds, documents.value.id] };
    const corrupt: VfsState = { ...initial, nodesById: { ...initial.nodesById, [documents.value.id]: corruptDirectory } };
    expect(walkVfsTree(corrupt, documents.value.id)).toMatchObject({ ok: false, error: { code: "VFS_ERROR" } });
    const command = run(createInitialShellSession(corrupt), corrupt, "find Documents");
    expect(command.execution?.exitCode).toBe(1);
    expect(outputText(command)).toBe("find: filesystem tree is not valid");
  });

  it("reads the latest renamed state without retaining a search index", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Old.txt", "", { now }));
    const session = createInitialShellSession(state);
    expect(outputText(run(session, state, "find Documents -name Old.txt"))).toContain("Old.txt");
    state = expectMutation(renameVfsNode(state, "/home/user/Documents/Old.txt", "New.txt", { now }));
    expect(run(session, state, "find Documents -name Old.txt").execution?.output).toEqual([]);
    expect(outputText(run(session, state, "find Documents -name New.txt"))).toContain("New.txt");
  });
});
