import { describe, expect, it } from "vitest";
import { createInitialVfsState, INITIAL_VFS_TIMESTAMP } from "../vfs/initialState";
import { appendVfsTextFile, createVfsDirectory, createVfsTextFile, moveVfsNodeToTrash, renameVfsNode } from "../vfs/mutations";
import { resolveVfsPath } from "../vfs/queries";
import type { VfsDirectoryNode, VfsState } from "../vfs/types";
import { executeShellInput } from "./execution";
import { getShellPosixBasename, getShellPosixDirname } from "./posixPath";
import { createInitialShellSession } from "./session";
import { formatShellVfsTree } from "./treeFormatting";
import type { ShellInputExecutionResult, ShellSessionState } from "./types";
import { walkVfsTree } from "./vfsTraversal";

const now = "2003-04-06T12:30:00.000Z";
const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): VfsState => {
  if (!result.ok) throw new Error("fixture mutation failed");
  return result.state;
};
const run = (session: ShellSessionState, state: VfsState, input: string): ShellInputExecutionResult => executeShellInput(session, state, input);
const outputText = (result: ShellInputExecutionResult): string => result.execution?.output.map((chunk) => chunk.text).join("") ?? "";

describe("Shell lexical POSIX path helpers", () => {
  it("returns lexical basenames without VFS lookups", () => {
    expect(getShellPosixBasename("/home/user/Documents/Notes.txt")).toBe("Notes.txt");
    expect(getShellPosixBasename("Documents/Notes.txt")).toBe("Notes.txt");
    expect(getShellPosixBasename("Notes.txt")).toBe("Notes.txt");
    expect(getShellPosixBasename("Missing/File.txt")).toBe("File.txt");
    expect(getShellPosixBasename("foo/bar///")).toBe("bar");
    expect(getShellPosixBasename("/")).toBe("/");
    expect(getShellPosixBasename(".")).toBe(".");
    expect(getShellPosixBasename("..")).toBe("..");
    expect(getShellPosixBasename("目录/你好 文件.txt")).toBe("你好 文件.txt");
    expect(getShellPosixBasename("<script>.txt")).toBe("<script>.txt");
  });

  it("returns lexical dirnames without VFS lookups", () => {
    expect(getShellPosixDirname("/home/user/Documents/Notes.txt")).toBe("/home/user/Documents");
    expect(getShellPosixDirname("Documents/Notes.txt")).toBe("Documents");
    expect(getShellPosixDirname("Notes.txt")).toBe(".");
    expect(getShellPosixDirname("Missing/File.txt")).toBe("Missing");
    expect(getShellPosixDirname("/home/user/Documents/")).toBe("/home/user");
    expect(getShellPosixDirname("/")).toBe("/");
    expect(getShellPosixDirname(".")).toBe(".");
    expect(getShellPosixDirname("..")).toBe(".");
    expect(getShellPosixDirname("目录/你好 文件.txt")).toBe("目录");
  });
});

describe("Shell stat command", () => {
  it("prints real file metadata in deterministic field order", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Stat.txt", "你好", { now }));
    const revision = state.revision;
    const output = outputText(run(createInitialShellSession(state), state, "stat Documents/Stat.txt"));

    expect(output).toBe([
      "Path: /home/user/Documents/Stat.txt",
      "Name: Stat.txt",
      "Type: file",
      "Size: 6 bytes",
      "MIME Type: text/plain",
      "Encoding: utf-8",
      `Created: ${now}`,
      `Modified: ${now}`,
      "",
    ].join("\n"));
    expect(output).not.toContain("Permissions:");
    expect(output).not.toContain("Owner:");
    expect(state.revision).toBe(revision);
  });

  it("prints directory, root, and Trash direct item counts without Trash metadata", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "TrashStat.txt", "", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/TrashStat.txt", { now }));
    const session = createInitialShellSession(state);
    const documents = outputText(run(session, state, "stat Documents"));
    const root = outputText(run(session, state, "stat /"));
    const trash = outputText(run(session, state, "stat /home/user/.local/share/Trash/files"));
    const file = outputText(run(session, state, "stat /home/user/.local/share/Trash/files/TrashStat.txt"));
    const documentsNode = resolveVfsPath(state, "/home/user/Documents");
    const rootNode = resolveVfsPath(state, "/");
    if (!documentsNode.ok || documentsNode.value.kind !== "directory" || !rootNode.ok || rootNode.value.kind !== "directory") {
      throw new Error("Directory fixtures missing");
    }

    expect(documents).toContain(`Type: directory\nItems: ${documentsNode.value.childIds.length}`);
    expect(documents).toContain(`Created: ${INITIAL_VFS_TIMESTAMP}`);
    expect(root).toContain(`Name: /\nType: directory\nItems: ${rootNode.value.childIds.length}`);
    expect(trash).toContain("Path: /home/user/.local/share/Trash/files\nName: files\nType: directory\nItems: 1");
    expect(file).toContain("Path: /home/user/.local/share/Trash/files/TrashStat.txt");
    expect(file).not.toContain("Original");
    expect(file).not.toContain("trashedAt");
  });

  it("reads latest append and rename metadata and reports missing nodes", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "Old.txt", "A", { now }));
    state = expectMutation(appendVfsTextFile(state, "/home/user/Documents/Old.txt", "你好", { now: "2003-04-06T12:40:00.000Z" }));
    state = expectMutation(renameVfsNode(state, "/home/user/Documents/Old.txt", "New.txt", { now }));
    const session = createInitialShellSession(state);

    expect(outputText(run(session, state, "stat Documents/New.txt"))).toContain("Size: 7 bytes");
    expect(outputText(run(session, state, "stat Documents/New.txt"))).toContain(`Modified: ${now}`);
    expect(outputText(run(session, state, "stat Documents/Old.txt"))).toBe("stat: no such file or directory: Documents/Old.txt");
    expect(run(session, state, "stat").execution?.exitCode).toBe(2);
  });
});

describe("Shell basename and dirname commands", () => {
  it("works for nonexistent lexical paths without changing revision", () => {
    const state = createInitialVfsState();
    const session = createInitialShellSession(state);
    const revision = state.revision;

    expect(outputText(run(session, state, "basename Missing/File.txt"))).toBe("File.txt\n");
    expect(outputText(run(session, state, "dirname Missing/File.txt"))).toBe("Missing\n");
    expect(outputText(run(session, state, "basename /"))).toBe("/\n");
    expect(outputText(run(session, state, "dirname Notes.txt"))).toBe(".\n");
    expect(state.revision).toBe(revision);
  });
});

describe("Shell tree command", () => {
  it("renders preorder ASCII connectors in VFS child order", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "TreeTest", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/TreeTest", "A.txt", "", { now }));
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents/TreeTest", "Sub", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/TreeTest/Sub", "B.txt", "", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents/TreeTest", "C.txt", "", { now }));
    const revision = state.revision;
    const output = outputText(run(createInitialShellSession(state), state, "tree Documents/TreeTest"));

    expect(output).toBe([
      "/home/user/Documents/TreeTest",
      "|-- A.txt",
      "|-- Sub",
      "|   `-- B.txt",
      "`-- C.txt",
      "",
    ].join("\n"));
    expect(output).not.toContain("├");
    expect(output).not.toContain("└");
    expect(state.revision).toBe(revision);
  });

  it("supports file, empty, relative, root, and Trash starts", () => {
    let state = createInitialVfsState();
    state = expectMutation(createVfsDirectory(state, "/home/user/Documents", "EmptyTree", { now }));
    state = expectMutation(createVfsTextFile(state, "/home/user/Documents", "TrashTree.txt", "", { now }));
    state = expectMutation(moveVfsNodeToTrash(state, "/home/user/Documents/TrashTree.txt", { now }));
    let session = createInitialShellSession(state);
    session = run(session, state, "cd Documents").session;

    expect(outputText(run(session, state, "tree Welcome.md"))).toBe("/home/user/Documents/Welcome.md\n");
    expect(outputText(run(session, state, "tree EmptyTree"))).toBe("/home/user/Documents/EmptyTree\n");
    expect(outputText(run(session, state, "tree ..")).startsWith("/home/user\n")).toBe(true);
    expect(outputText(run(session, state, "tree /home/user/.local/share/Trash/files"))).toBe("/home/user/.local/share/Trash/files\n`-- TrashTree.txt\n");
    expect(run(session, state, "tree Missing").execution?.exitCode).toBe(1);
  });

  it("shares find traversal's visited guard and controlled failure", () => {
    const initial = createInitialVfsState();
    const documents = resolveVfsPath(initial, "/home/user/Documents");
    if (!documents.ok || documents.value.kind !== "directory") throw new Error("Documents fixture missing");
    const corruptDirectory: VfsDirectoryNode = { ...documents.value, childIds: [...documents.value.childIds, documents.value.id] };
    const corrupt: VfsState = { ...initial, nodesById: { ...initial.nodesById, [documents.value.id]: corruptDirectory } };
    const walked = walkVfsTree(corrupt, documents.value.id);
    const command = run(createInitialShellSession(corrupt), corrupt, "tree Documents");

    expect(walked).toMatchObject({ ok: false, error: { code: "VFS_ERROR" } });
    expect(outputText(command)).toBe("tree: filesystem tree is not valid");
    expect(command.execution?.exitCode).toBe(1);
  });

  it("formats the shared walk result without traversing a second VFS tree", () => {
    const state = createInitialVfsState();
    const root = resolveVfsPath(state, "/home/user/Documents");
    if (!root.ok) throw new Error("Documents fixture missing");
    const walked = walkVfsTree(state, root.value.id);
    if (!walked.ok) throw new Error("walk failed");

    expect(formatShellVfsTree(walked.value)).toContain("Welcome.md");
  });
});
