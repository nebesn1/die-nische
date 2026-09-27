import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../vfs/initialState";
import {
  createVfsDirectory,
  createVfsTextFile,
  emptyVfsTrash,
  moveVfsNode,
  moveVfsNodeToTrash,
  renameVfsNode,
  writeVfsTextFile,
} from "../vfs/mutations";
import type { VfsState } from "../vfs/types";
import { executeShellInput } from "./execution";
import { createInitialShellSession } from "./session";
import type { ShellSessionState } from "./types";

const now = "2026-08-04T00:00:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): VfsState => {
  if (!result.ok) {
    throw new Error("fixture mutation failed");
  }

  return result.state;
};

const run = (session: ShellSessionState, vfsState: VfsState, input: string) =>
  executeShellInput(session, vfsState, input);

const outputText = (result: ReturnType<typeof executeShellInput>): string =>
  result.execution?.output.map((chunk) => chunk.text).join("\n") ?? "";

describe("Shell command execution", () => {
  it("treats whitespace-only input as an immutable no-op", () => {
    const vfsState = createInitialVfsState();
    const session = createInitialShellSession(vfsState);
    const result = run(session, vfsState, "   \t\n");

    expect(result.session).toBe(session);
    expect(result.execution).toBeNull();
  });

  it("runs pwd and cd with absolute, relative, dot, dot-dot, and quoted paths", () => {
    let vfsState = createInitialVfsState();
    vfsState = expectMutation(createVfsDirectory(vfsState, "/home/user/Documents", "Work Projects", { now }));
    let session = createInitialShellSession(vfsState);

    let result = run(session, vfsState, "pwd");
    expect(outputText(result)).toBe("/home/user");
    expect(result.execution?.exitCode).toBe(0);
    expect(vfsState.revision).toBe(1);

    result = run(result.session, vfsState, "cd /home/user/Documents");
    session = result.session;
    expect(result.execution?.exitCode).toBe(0);
    expect(session.transcript[1]?.cwdPath).toBe("/home/user");

    result = run(session, vfsState, "pwd");
    expect(outputText(result)).toBe("/home/user/Documents");

    result = run(result.session, vfsState, "cd './Work Projects'");
    expect(result.execution?.exitCode).toBe(0);
    result = run(result.session, vfsState, "cd ..");
    expect(run(result.session, vfsState, "pwd").execution?.output[0]?.text).toBe("/home/user/Documents");
    result = run(result.session, vfsState, "cd");
    expect(run(result.session, vfsState, "pwd").execution?.output[0]?.text).toBe("/home/user");
  });

  it("reports cd errors without changing cwd", () => {
    const vfsState = createInitialVfsState();
    let session = createInitialShellSession(vfsState);
    const missing = run(session, vfsState, "cd Missing");
    session = missing.session;
    const file = run(session, vfsState, "cd Documents/Welcome.md");
    const tooMany = run(session, vfsState, "cd Documents Downloads");

    expect(missing.execution?.exitCode).toBe(1);
    expect(outputText(missing)).toBe("cd: no such file or directory: Missing");
    expect(file.execution?.exitCode).toBe(1);
    expect(outputText(file)).toBe("cd: not a directory: Documents/Welcome.md");
    expect(tooMany.execution?.exitCode).toBe(2);
    expect(run(tooMany.session, vfsState, "pwd").execution?.output[0]?.text).toBe("/home/user");
    expect(run(tooMany.session, vfsState, "cd ~").execution?.exitCode).toBe(0);
    expect(run(run(tooMany.session, vfsState, "cd ~").session, vfsState, "pwd").execution?.output[0]?.text).toBe(
      "/home/user",
    );
  });

  it("uses the XDG-style virtual Trash path for Shell access, not the Konqueror protocol", () => {
    const moved = moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", { now });

    if (!moved.ok) {
      throw new Error("Trash fixture failed");
    }

    const homeSession = createInitialShellSession(moved.state);
    const shorthand = run(homeSession, moved.state, "cd ~/.local/share/Trash/files");
    const absolute = run(homeSession, moved.state, "cd /home/user/.local/share/Trash/files");
    const oldPath = run(homeSession, moved.state, "cd /trash");
    const protocol = run(homeSession, moved.state, "cd trash:/");

    expect(shorthand.execution?.exitCode).toBe(0);
    expect(outputText(run(shorthand.session, moved.state, "pwd"))).toBe("/home/user/.local/share/Trash/files");
    expect(outputText(run(shorthand.session, moved.state, "ls"))).toContain("Notes.txt");
    expect(outputText(run(shorthand.session, moved.state, "cat Notes.txt"))).toContain("browser memory");
    expect(absolute.execution?.exitCode).toBe(0);
    expect(oldPath.execution?.exitCode).toBe(1);
    expect(outputText(oldPath)).toBe("cd: no such file or directory: /trash");
    expect(protocol.execution?.exitCode).toBe(1);
    expect(outputText(protocol)).toBe("cd: no such file or directory: trash:/");
  });

  it("expands tilde operands consistently for VFS read and inspection commands", () => {
    const moved = moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", { now });

    if (!moved.ok) {
      throw new Error("Trash fixture failed");
    }

    const session = createInitialShellSession(moved.state);
    const documents = run(session, moved.state, "ls ~/Documents");
    const trash = run(documents.session, moved.state, "ls ~/.local/share/Trash/files");
    const cat = run(trash.session, moved.state, "cat ~/Documents/Welcome.md");
    const stat = run(cat.session, moved.state, "stat ~/Documents/Welcome.md");
    const tree = run(stat.session, moved.state, "tree ~/.local/share/Trash/files");
    const find = run(tree.session, moved.state, "find ~/.local/share/Trash/files -name Notes.txt");
    const relative = run(find.session, moved.state, "ls Documents");
    const absolute = run(relative.session, moved.state, "ls /home/user/Documents");
    const oldPath = run(absolute.session, moved.state, "ls /trash");
    const protocol = run(oldPath.session, moved.state, "ls trash:/");

    expect(outputText(documents)).toContain("Welcome.md");
    expect(outputText(trash)).toBe("Notes.txt");
    expect(outputText(cat)).toContain("# Welcome to die Nische");
    expect(outputText(stat)).toContain("Path: /home/user/Documents/Welcome.md");
    expect(outputText(tree)).toContain("/home/user/.local/share/Trash/files");
    expect(outputText(find)).toContain("/home/user/.local/share/Trash/files/Notes.txt");
    expect(relative.execution?.exitCode).toBe(0);
    expect(absolute.execution?.exitCode).toBe(0);
    expect(oldPath.execution?.exitCode).toBe(1);
    expect(protocol.execution?.exitCode).toBe(1);
  });

  it("runs ls with directories, files, hidden names, options, and empty directories", () => {
    let vfsState = createInitialVfsState();
    vfsState = expectMutation(createVfsTextFile(vfsState, "/home/user/Documents", ".hidden", "", { now }));
    const session = createInitialShellSession(vfsState);
    const home = run(session, vfsState, "ls");
    const documents = run(home.session, vfsState, "ls Documents");
    const file = run(documents.session, vfsState, "ls Documents/Welcome.md");
    const empty = run(file.session, vfsState, "ls Downloads");
    const option = run(empty.session, vfsState, "ls -l");

    expect(outputText(home)).toBe(["Desktop/", "Documents/", "Downloads/", "Music/", "Pictures/", "Videos/", ".local/"].join("\n"));
    expect(outputText(documents)).toContain("Welcome.md");
    expect(outputText(documents)).toContain("Notes.txt");
    expect(outputText(documents)).toContain(".hidden");
    expect(outputText(file)).toBe("Welcome.md");
    expect(empty.execution?.exitCode).toBe(0);
    expect(empty.execution?.output).toEqual([]);
    expect(option.execution?.exitCode).toBe(2);
    expect(outputText(option)).toBe("ls: unsupported option: -l");
  });

  it("runs cat without trimming text and supports UTF-8 and empty files", () => {
    let vfsState = createInitialVfsState();
    vfsState = expectMutation(createVfsTextFile(vfsState, "/home/user/Documents", "Chinese.txt", "你好\nKDE", { now }));
    vfsState = expectMutation(createVfsTextFile(vfsState, "/home/user/Documents", "Empty.txt", "", { now }));
    const image = Object.values(vfsState.nodesById).find((node) =>
      node.kind === "file" && node.parentId === vfsState.specialLocations.pictures && node.content.kind === "asset-url",
    );
    if (!image || image.kind !== "file") throw new Error("Repository image fixture missing");
    const session = createInitialShellSession(vfsState);
    const welcome = run(session, vfsState, "cat Documents/Welcome.md");
    const chinese = run(welcome.session, vfsState, "cat Documents/Chinese.txt");
    const empty = run(chinese.session, vfsState, "cat Documents/Empty.txt");
    const directory = run(empty.session, vfsState, "cat Documents");
    const imageResult = run(directory.session, vfsState, `cat Pictures/${image.name}`);
    const missing = run(imageResult.session, vfsState, "cat Missing.txt");
    const usage = run(missing.session, vfsState, "cat");

    expect(outputText(welcome)).toContain("# Welcome to die Nische");
    expect(outputText(chinese)).toBe("你好\nKDE");
    expect(empty.execution?.output).toEqual([]);
    expect(outputText(directory)).toBe("cat: Documents: is a directory");
    expect(imageResult.execution?.exitCode).toBe(1);
    expect(outputText(imageResult)).toBe(`cat: Pictures/${image.name}: VFS file is not backed by editable text.`);
    expect(outputText(missing)).toBe("cat: Missing.txt: no such file");
    expect(usage.execution?.exitCode).toBe(2);
  });

  it("runs clear and help with deterministic transcript and history behavior", () => {
    const vfsState = createInitialVfsState();
    let result = run(createInitialShellSession(vfsState), vfsState, "pwd");
    result = run(result.session, vfsState, "clear");

    expect(result.execution?.clearTranscript).toBe(true);
    expect(result.session.transcript).toEqual([]);
    expect(result.session.commandHistory).toEqual(["pwd", "clear"]);
    expect(result.session.nextTranscriptEntryId).toBe(2);

    const afterClear = run(result.session, vfsState, "help");
    const helpCd = run(afterClear.session, vfsState, "help cd");
    const helpUnknown = run(helpCd.session, vfsState, "help missing");
    const clearError = run(helpUnknown.session, vfsState, "clear now");

    expect(afterClear.session.transcript[0]?.id).toBe(2);
    expect(outputText(afterClear)).toBe([
      "Supported commands:",
      "  pwd",
      "  cd [path]",
      "  ls [path]",
      "  cat <path>",
      "  echo [text...]",
      "  append <path> <text...>",
      "  head [-n <count>] <path>",
      "  tail [-n <count>] <path>",
      "  wc [-l|-w|-c] <path>",
      "  grep [-i] [-n] <pattern> <path>",
      "  find [path] [-name <literal-name>]",
      "  stat <path>",
      "  basename <path>",
      "  dirname <path>",
      "  tree [path]",
      "  mkdir <path>",
      "  touch <path>",
      "  cp <source> <destination>",
      "  mv <source> <destination>",
      "  trash <path>",
      "  restore <trash-entry>",
      "  permanent-delete [--confirm] <trash-entry>",
      "  empty-trash [--confirm]",
      "  history [count]",
      "  clear",
      "  help [command]",
    ].join("\n"));
    expect(outputText(helpCd)).toBe("cd [path] - change the current directory");
    expect(outputText(run(helpCd.session, vfsState, "help mkdir"))).toBe("mkdir <path> - create a directory");
    expect(outputText(run(helpCd.session, vfsState, "help echo"))).toBe(
      "echo [text...] - print text without variable or escape expansion",
    );
    expect(outputText(run(helpCd.session, vfsState, "help append"))).toBe(
      "append <path> <text...> - append one line to an existing UTF-8 text file",
    );
    expect(outputText(run(helpCd.session, vfsState, "help head"))).toBe(
      "head [-n <count>] <path> - print the first lines of a UTF-8 text file",
    );
    expect(outputText(run(helpCd.session, vfsState, "help tail"))).toBe(
      "tail [-n <count>] <path> - print the last lines of a UTF-8 text file",
    );
    expect(outputText(run(helpCd.session, vfsState, "help wc"))).toContain("not POSIX newline counting");
    expect(outputText(run(helpCd.session, vfsState, "help grep"))).toContain("regular expressions are not supported");
    expect(outputText(run(helpCd.session, vfsState, "help find"))).toContain("without glob patterns");
    expect(outputText(run(helpCd.session, vfsState, "help stat"))).toBe(
      "stat <path> - show actual VFS metadata for one file or directory",
    );
    expect(outputText(run(helpCd.session, vfsState, "help basename"))).toBe(
      "basename <path> - return a lexical POSIX basename; the path does not need to exist",
    );
    expect(outputText(run(helpCd.session, vfsState, "help dirname"))).toBe(
      "dirname <path> - return a lexical POSIX dirname; the path does not need to exist",
    );
    expect(outputText(run(helpCd.session, vfsState, "help tree"))).toContain("current child order");
    expect(outputText(run(helpCd.session, vfsState, "help history"))).toContain("current-session commands");
    expect(outputText(run(helpCd.session, vfsState, "help restore"))).toBe(
      "restore <trash-entry> - restore a top-level Trash item",
    );
    expect(helpUnknown.execution?.exitCode).toBe(2);
    expect(clearError.execution?.exitCode).toBe(2);
    expect(clearError.session.transcript.length).toBe(4);
  });

  it("records parse errors and unknown commands without launching applications", () => {
    const vfsState = createInitialVfsState();
    let result = run(createInitialShellSession(vfsState), vfsState, "konqueror");
    result = run(result.session, vfsState, "cat Notes.txt | less");

    expect(result.session.commandHistory).toEqual(["konqueror", "cat Notes.txt | less"]);
    expect(result.session.transcript[0]?.output[0]?.text).toBe("konqueror: command not found");
    expect(result.session.transcript[0]?.exitCode).toBe(2);
    expect(result.session.transcript[1]?.output[0]?.text).toBe(
      "Shell operators and command substitution are not supported.",
    );
    expect(result.session.cwdNodeId).toBe(vfsState.specialLocations.home);
  });

  it("falls back when cwd is deleted and then resolves relative paths from fallback", () => {
    let vfsState = createInitialVfsState();
    vfsState = expectMutation(createVfsDirectory(vfsState, "/home/user/Documents", "Project", { now }));
    let session = run(createInitialShellSession(vfsState), vfsState, "cd Documents/Project").session;
    vfsState = expectMutation(moveVfsNodeToTrash(vfsState, "/home/user/Documents/Project", { now }));
    vfsState = expectMutation(emptyVfsTrash(vfsState, { now }));
    const result = run(session, vfsState, "ls Documents");
    session = result.session;

    expect(result.execution?.output[0]).toEqual({
      stream: "system",
      text: "shell: current directory is no longer available; returned to /home/user",
    });
    expect(session.cwdNodeId).toBe(vfsState.specialLocations.home);
    expect(outputText(result)).toContain("Welcome.md");
  });

  it("can read shared VFS changes without mutating revision", () => {
    let vfsState = createInitialVfsState();
    vfsState = expectMutation(createVfsTextFile(vfsState, "/home/user/Documents", "Draft.txt", "old", { now }));
    vfsState = expectMutation(writeVfsTextFile(vfsState, "/home/user/Documents/Draft.txt", "saved text", { now }));
    vfsState = expectMutation(renameVfsNode(vfsState, "/home/user/Documents/Draft.txt", "Final.txt", { now }));
    vfsState = expectMutation(moveVfsNode(vfsState, "/home/user/Documents/Final.txt", "/home/user/Downloads", { now }));
    vfsState = expectMutation(moveVfsNodeToTrash(vfsState, "/home/user/Downloads/Final.txt", { now }));
    const revision = vfsState.revision;
    let session = createInitialShellSession(vfsState);
    const result = run(session, vfsState, "ls Documents");
    session = result.session;
    const oldPath = run(session, vfsState, "cat Documents/Draft.txt");
    const trashed = run(oldPath.session, vfsState, "cat /home/user/.local/share/Trash/files/Final.txt");

    expect(outputText(result)).not.toContain("Draft.txt");
    expect(outputText(oldPath)).toBe("cat: Documents/Draft.txt: no such file");
    expect(outputText(trashed)).toBe("saved text");
    expect(vfsState.revision).toBe(revision);
  });

  it("keeps separate sessions independent and immutable", () => {
    const vfsState = createInitialVfsState();
    const first = createInitialShellSession(vfsState);
    const second = createInitialShellSession(vfsState);
    const movedFirst = run(first, vfsState, "cd Documents").session;

    expect(movedFirst).not.toBe(first);
    expect(first.cwdNodeId).toBe(vfsState.specialLocations.home);
    expect(second.cwdNodeId).toBe(vfsState.specialLocations.home);
    expect(run(movedFirst, vfsState, "pwd").execution?.output[0]?.text).toBe("/home/user/Documents");
    expect(run(second, vfsState, "pwd").execution?.output[0]?.text).toBe("/home/user");
  });
});
