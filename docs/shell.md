# Shell Core

Phase 4.10 adds current-session history inspection and native terminal text usability while keeping the Shell core pure TypeScript. Konsole owns React rendering, command input, local draft state, completion candidate state, Up/Down history navigation, focus, scrolling, the paste queue, and the adapter from `useVfs()` Provider commands to the Shell mutation port.

## Supported Commands

```text
pwd
cd [path]
ls [path]
cat <path>
echo [text...]
append <path> <text...>
head [-n <count>] <path>
tail [-n <count>] <path>
wc [-l|-w|-c] <path>
grep [-i] [-n] <pattern> <path>
find [path] [-name <literal-name>]
stat <path>
basename <path>
dirname <path>
tree [path]
mkdir <path>
touch <path>
cp <source> <destination>
mv <source> <destination>
trash <path>
restore <trash-entry>
permanent-delete [--confirm] <trash-entry>
empty-trash [--confirm]
history [count]
clear
help [command]
```

Commands are case-sensitive. `PWD` is an unknown command.

Exit codes:

- `0`: success
- `1`: VFS/runtime command error
- `2`: parse, usage, unsupported option, or unknown command

## Tokenizer

The tokenizer is pure and does not access VFS.

Completion uses a separate partial lexer. Unlike the formal tokenizer, it accepts unclosed single and double quotes while the user is editing a command, identifies the token at the current caret, and returns the raw replacement range for that token. It does not execute commands, does not modify the Shell session, and does not replace parse-time validation.

Supported syntax:

- Space, tab, and newline separate tokens.
- Consecutive whitespace is collapsed.
- Single quotes preserve literal text and remove the quote characters.
- Double quotes preserve spaces and remove the quote characters.
- Empty quotes produce an empty string argument.
- Backslash outside quotes escapes the next character.
- Backslash inside double quotes escapes the next character.
- Backslash inside single quotes is literal.

Examples:

```text
cat Notes.txt
cat 'Current Tasks.txt'
cat "Current Tasks.txt"
cat Current\ Tasks.txt
cat ""
```

## Unsupported Syntax

Unquoted shell operators and substitution syntax are rejected with `UNSUPPORTED_SYNTAX`:

```text
|
&&
||
>
>>
<
;
&
`
$(
```

Quoted symbols are ordinary filename characters. The Shell does not execute partial command lines after an unsupported operator.

Not supported:

- pipes
- redirection
- command chaining
- background jobs
- command substitution
- variables
- `$HOME`
- `~`
- globbing
- scripts
- real process execution
- overwrite/force/interactive file operations

## Invocation Model

Parsing returns:

```ts
interface ShellCommandInvocation {
  readonly commandName: string;
  readonly args: readonly string[];
  readonly rawInput: string;
}
```

The parser does not execute commands and does not import VFS.

## Session Model

Each Shell session owns:

- `cwdNodeId`
- `transcript`
- `commandHistory`
- `nextTranscriptEntryId`

`cwdNodeId` is the stable VFS node id for the current directory. Paths are derived from VFS when needed.

Transcript entries store:

- deterministic id
- raw input
- prompt cwd path
- output chunks
- exit code

Whitespace-only input is a no-op. Non-empty commands are added to command history, including repeated commands and failed commands. `clear` clears the visible transcript but keeps history and does not reset the next transcript id.

Konsole creates a session with `createInitialShellSession(vfs.state)` when the component mounts. It does not recreate the session when VFS revision changes. Minimize, virtual desktop changes, Show Desktop, and Move to Desktop keep the component mounted and preserve cwd, transcript, command history, and command draft. Closing the window unmounts Konsole and discards the local session; reopening starts at Home with an empty transcript and history.

## CWD Rules

Initial cwd is the VFS Home special location. If Home is invalid, cwd falls back to root.

Before every non-empty command, the executor validates that cwd:

- exists
- is a directory
- is reachable from root

If cwd is unavailable, the executor falls back to Home, then root, and prepends a system output chunk:

```text
shell: current directory is no longer available; returned to /home/user
```

Valid Trash directories are valid cwd values.

## Command Behavior

`pwd` prints the canonical current VFS path.

`cd [path]` accepts absolute and relative VFS paths. It supports `.`, `..`, and quoted spaces through the tokenizer. It does not expand `~`.

`ls [path]` lists directory children in VFS `childIds` order. Directories get a trailing `/`. Files are printed by basename. Options such as `-l` are rejected.

`cat <path>` reads a UTF-8 text file and outputs the exact content. Directories and missing files return controlled errors.

`echo [text...]` writes parsed arguments to stdout joined by one space and followed by one LF. It does not expand variables, interpret escapes, or implement `echo -n`; `-n` is ordinary text.

`append <path> <text...>` appends `text...` joined by one space plus one LF to an existing UTF-8 text file through Provider `appendTextFile`. It does not create missing files, does not write directories, and does not modify Trash files. If the existing file has no trailing newline, append does not insert an extra separator before the appended text.

`head [-n <count>] <path>` and `tail [-n <count>] <path>` read UTF-8 text files and print the first or last logical lines. The default count is `10`; `-n 0` is valid and prints nothing. Counts must be decimal non-negative safe integers. LF, CRLF, and lone CR terminators are preserved exactly, and no extra newline is added.

`wc [-l|-w|-c] <path>` reads one UTF-8 text file. With no option it prints logical line, word, and UTF-8 byte counts plus the canonical path. `-l`, `-w`, and `-c` select one count. Logical lines use `splitTextIntoPreservedLines(text).length`, so both `"abc"` and `"abc\n"` count as one line; this intentionally differs from POSIX newline-character counting. Words are maximal non-whitespace runs, and bytes use the shared UTF-8 byte-size helper.

`grep [-i] [-n] <pattern> <path>` matches a literal substring in each logical line. It is case-sensitive by default; `-i` uses non-locale lowercase comparison and `-n` adds a 1-based line number. Regular expressions are not supported, so `a.b` matches only literal `a.b`. Matching output preserves LF, CRLF, lone CR, and unterminated final lines. Match, no-match, and usage exit codes are `0`, `1`, and `2`; no-match has no stderr.

`find [path] [-name <literal-name>]` walks cwd or one absolute/relative start path in preorder depth-first `childIds` order and prints canonical absolute paths. A file may be the start node. `-name` is an exact, case-sensitive basename comparison, so `*.txt` matches only a node literally named `*.txt`. Trash is traversed as its current node tree without exposing metadata, and a visited-id guard rejects invalid repeated nodes.

`stat <path>` resolves one current VFS file or directory and emits only metadata the VFS actually stores: canonical path, name, type, timestamps, direct directory item count, or text-file size, MIME type, and encoding. It does not invent POSIX permissions, owner/group data, inode numbers, block counts, or access times. Trash nodes are reported as their current VFS nodes without Trash workflow metadata.

`basename <path>` and `dirname <path>` are lexical POSIX-slash operations: the operand does not need to exist in VFS. They remove trailing slashes except for `/`; `basename /` returns `/`, and a single relative name has dirname `.`. There is no suffix-removal or multiple-path form.

`tree [path]` walks cwd or one absolute/relative VFS start node with the same preorder, public-query traversal used by `find`. It prints the canonical start path then descendants in current `childIds` order using ASCII `|--`, `` `-- ``, `|   `, and spaces. A file start prints only its canonical path; an empty directory has no summary or `(empty)` line. It supports the current Trash tree and has no tree options, colors, sizes, or summary counts.

`history [count]` displays commands from the current Konsole session, oldest to newest, as `number` plus two spaces plus the raw command. The command reads history before its own invocation is appended, so it does not display itself; a later `history` shows it normally. An optional non-negative decimal safe-integer count shows the most recent entries while preserving their global numbering. `history 0` has no stdout. `clear` removes only transcript entries, not command history. History is destroyed when Konsole closes and is never persisted. `!n`, `!!`, `Ctrl+R`, and history options are not implemented.

Pressing Enter on an empty or whitespace-only Konsole input advances to a new prompt by adding a prompt-only transcript line. It is not a Shell command: it has no output, no VFS side effect, and no command-history entry. Pasted blank physical lines follow the same rule. A trailing newline ends its preceding pasted command but does not create an extra blank command; two trailing newlines represent one blank physical submission.

`mkdir <path>` creates one directory through the injected mutation port. Parent directories must already exist. `mkdir -p` is not supported.

`touch <path>` creates an empty UTF-8 `text/plain` file if the target does not exist. If the target is an existing file, this project treats touch as a successful no-op: content, `modifiedAt`, and VFS revision do not change. Directories fail with `touch: is a directory: <path>`.

`cp <source> <destination>` copies files and directory trees recursively through VFS `copyNode`. No `-r` flag is needed, and `-r` is rejected as an unsupported option. Existing destinations are not overwritten.

`mv <source> <destination>` moves files or directories through VFS `moveNode`. It preserves node ids and supports same-directory rename through the destination-new-name form. `mv source source` is a successful no-op.

`trash <path>` moves a file or directory to VFS Trash through `moveNodeToTrash`, preserving the VFS Trash metadata model and deterministic Trash conflict names.

`restore <trash-entry>` restores a top-level Trash entry. The operand is the current Trash display path, not `originalName`. Restore does not overwrite conflicts and fails if the original parent is unavailable.

`permanent-delete <trash-entry>` prints an irreversible warning and does not mutate VFS. `permanent-delete --confirm <trash-entry>` permanently deletes the top-level Trash entry and complete subtree. The `--confirm` flag must be the first argument.

`empty-trash` prints an irreversible warning and does not mutate VFS. `empty-trash --confirm` permanently deletes all Trash entries, preserves the Trash root, and is a successful no-op when Trash is already empty.

`clear` clears transcript state only. It does not clear browser console output.

`help [command]` prints a fixed command list or a one-line usage entry.

## Write Command Rules

Mutation commands use:

```ts
interface ShellMutationPort {
  createDirectory(...)
  createTextFile(...)
  appendTextFile(...)
  copyNode(...)
  moveNode(...)
  moveNodeToTrash(...)
  restoreNodeFromTrash(...)
  deleteNodePermanently(...)
  emptyTrash(...)
}
```

`executeShellInput` accepts an optional `ShellExecutionEnvironment` with `mutations` and `now`. The older three-argument call remains valid for read-only sessions. If a write command runs without `mutations`, it returns:

```text
shell: write operations are not available in this session
```

and does not call the clock.

`append` uses an atomic VFS append command exposed by Provider. The Shell does not read old content and then overwrite it; the append mutation calculates the new text from the latest Provider state, updates UTF-8 byte size and `modifiedAt`, preserves id, parent id, created time, MIME, encoding, and directory order, and increments revision once. Empty low-level append text is a successful no-op.

Creation targets support absolute paths, relative paths, quotes, and backslash-escaped spaces. The Shell normalizes the operand, splits parent/name, validates the name with VFS rules, and requires the parent to be an existing directory. Creation under the canonical Trash backend or its descendants is rejected.

`cp` and `mv` destination rules:

- Existing directory: destination is a directory and the source name is retained.
- Missing destination: destination is a new path; dirname must exist and basename becomes `newName`.
- Existing file: fail, no overwrite.
- Trailing slash with a missing directory: fail.
- Source or destination inside Trash: fail for ordinary `cp` and `mv`.
- `trash` is the only Shell write command that places nodes in Trash.

Trash management rules:

- `restore` and `permanent-delete` accept only top-level Trash entries: direct children of `/home/user/.local/share/Trash/files` with `VfsTrashEntry` metadata.
- Trash descendants such as `/home/user/.local/share/Trash/files/Project/Subfolder` can be browsed by read commands but cannot be restored or permanently deleted independently.
- Relative Trash entry operands work when cwd is `/home/user/.local/share/Trash/files`; that absolute backend prefix works from any cwd.
- Every Shell operand that resolves a VFS path first uses the shared current-user tilde expansion. `~` maps to `/home/user`; `~/...` maps below that home, so `ls ~/.local/share/Trash/files`, `cat ~/Documents/Welcome.md`, and `cd ~/.local/share/Trash/files` all reach the same canonical nodes. This covers read, inspection, traversal, and mutation path operands (`cd`, `ls`, `cat`, `stat`, `tree`, `find`, `head`, `tail`, `wc`, `grep`, `mkdir`, `touch`, `append`, `cp`, `mv`, `trash`, `restore`, and `permanent-delete`).
- This is intentionally not full POSIX expansion: only an operand exactly equal to `~` or beginning `~/` is expanded; `~otheruser` and `abc~def` remain ordinary unresolved inputs. The existing tokenizer has already removed quote delimiters before command dispatch, so this phase does not add quote-sensitive Bash expansion semantics. `basename` and `dirname` remain lexical helpers rather than VFS path consumers. `trash:/` itself is intentionally not a Shell path.
- `permanent-delete` and `empty-trash` never create pending confirmation state. The user must type the exact confirmed command, making destructive history entries explicit.
- Unconfirmed destructive commands return `CONFIRMATION_REQUIRED`, use exit code `2`, write stderr, and do not call the mutation port or clock.
- Confirmed permanent delete or empty Trash can invalidate cwd if cwd is inside a deleted subtree. The next command uses the normal cwd fallback warning and returns to Home.
- Restoring the top-level entry that contains cwd preserves the stable cwd node id; the next prompt derives the restored path.

This phase rejects any argument beginning with `-` as an unsupported option for mutation commands. There is no `--` option terminator, so file names beginning with `-` cannot be operated on by these Shell commands yet.

## Error Model

Shell errors are separate from VFS errors:

```ts
type ShellErrorCode =
  | "PARSE_ERROR"
  | "UNSUPPORTED_SYNTAX"
  | "UNKNOWN_COMMAND"
  | "INVALID_ARGUMENT"
  | "INVALID_ARGUMENT_COUNT"
  | "UNSUPPORTED_OPTION"
  | "CONFIRMATION_REQUIRED"
  | "MUTATION_UNAVAILABLE"
  | "CWD_UNAVAILABLE"
  | "VFS_ERROR";
```

VFS errors can be attached as `cause`, but shell UI does not need to parse VFS error messages to determine the shell-level error.

## VFS Sharing

The Shell receives the caller's current `VfsState` on each execution. It does not create a VFS store, use `VfsProvider`, or copy the file tree into session state.

Konsole calls `useVfs()` and passes the latest `vfs.state` plus a Provider-backed mutation port into `executeShellInput` at command submission time. Konqueror-created, renamed, moved, trashed, restored, deleted, or saved files can be read by later `ls` and `cat` commands because the Shell session does not store a VFS snapshot.

Read-only Shell commands do not mutate VFS and never increment `revision`. Successful write commands update shared VFS through Provider commands and follow underlying VFS revision rules. Failed writes and no-op writes do not increment revision.

## Konsole UI

Konsole is registered as a multiple-instance application with unsuffixed base title `Konsole`. QuickLaunch Konsole, K Menu System -> Konsole, and Desktop `Open Terminal` explicitly create a fresh instance without an application intent. Generic Shell caption resolution displays `Konsole`, `Konsole<2>`, and later collision ranks. Ordinary Runtime `launchApplication("konsole")` retains its generic focus/reuse behavior.

Each Konsole component mount owns an independent `ShellSessionState`, command draft, history-navigation cursor, completion state, paste queue, selection request, and input/transcript refs. Explicit new windows begin at Home with empty history and transcript; cwd is a stable VFS directory id and relative commands resolve from that exact instance. The normalized VFS remains shared, so a later command in another terminal can observe a committed VFS mutation without receiving the first terminal's cwd, history, output, or draft.

Prompt format is fixed and virtual:

```text
user@kde3:/home/user$
```

The prompt uses:

- username `user`
- host `kde3`
- full canonical VFS path from `getVfsPathForNode`
- `$` as the ordinary-user marker

Konsole does not read the real browser or OS username, host, shell, or home directory.

Transcript rendering:

- Each `ShellTranscriptEntry` renders its stored prompt cwd path, raw input, and output chunks.
- Output chunks render as plain text with stream-specific classes for `stdout`, `stderr`, and `system`.
- Whitespace and line breaks are preserved with normal text nodes and CSS.
- `clear` uses the Shell core result and clears visible transcript without resetting command history.
- Transcript updates scroll the terminal viewport to the bottom without smooth animation or timers.

Command input:

- A single-line `input type="text"` is used.
- The prompt is display text and is not part of the input value.
- Enter submits unless IME composition is active.
- ArrowUp and ArrowDown navigate `ShellSessionState.commandHistory` through local UI cursor state.
- Browsing history preserves the draft that existed before history navigation and restores it after moving past the newest entry.
- Browser text copy, cut, and paste remain native input behavior.

- Single-line clipboard text remains native browser paste behavior. Multi-line clipboard text is handled locally as a terminal-like physical input stream: LF, CRLF, and lone CR terminate and queue commands in order.
- Only terminated pasted lines execute immediately. The final unterminated segment remains in the input draft, does not enter transcript/history, and requires Enter.
- Blank pasted physical lines are passed to the existing Shell no-op behavior. A failed queued command records its usual stderr/transcript result and does not stop following physical lines.
- The existing parser remains single-line. Quotes do not continue across pasted physical lines; there is no continuation prompt, backslash-newline continuation, heredoc, or bracketed paste protocol.
- Destructive commands retain the existing explicit `--confirm` requirement even when they originate in a paste queue.

Completion:

- Tab completes only while the command input is focused and IME composition is not active.
- Completion never submits the command, appends transcript entries, adds command history, changes cwd, or mutates VFS.
- The first token completes command names in fixed registry order. For example `pw` becomes `pwd `, while `c` shows `cd`, `cat`, `cp`, and `clear`.
- `help` completes its first argument from the command registry, such as `help mk` to `help mkdir`.
- Path completion reads the latest shared VFS state each time Tab is pressed. Konqueror changes, Shell `mkdir`/`touch`/`append`/`mv`, Trash, Restore, and permanent delete are reflected on the next completion attempt.
- `cd` completes directories; `cat`, `head`, `tail`, and `wc` complete files; `grep` completes only its final file operand after supported flags and pattern; `find`, `stat`, `basename`, `dirname`, and `tree` complete files and directories only for their optional or required path. Counts, patterns, flags, and `find -name` values are not completed.
- `restore` and `permanent-delete` complete only top-level Trash entries. `permanent-delete --confirm /home/user/.local/share/Trash/files/Te` completes the path operand, but `--confirm` itself is not option-completed.
- Directory candidates append `/`. Unique unquoted file candidates append a trailing space. Quoted file candidates remain inside the current quote and do not auto-close the quote.
- Multiple candidates use the longest common prefix. If the prefix grows the active token, only that token is replaced and any text after the caret is preserved. Otherwise candidates are displayed without changing the draft.
- Candidate order follows command registry order or VFS `childIds` order. Matching is case-sensitive and includes hidden names.
- Unquoted path insertion uses backslash escaping for spaces, tabs, quotes, backslashes, and shell-significant characters. Double-quoted insertion keeps spaces literal and escapes `"` and `\`. Single-quoted insertion skips names containing `'`.
- Candidate display is a plain-text `role=status` region inside the black terminal viewport. It is not a datalist, popup menu, button list, transcript entry, or command history entry.

Keyboard shortcuts:

- Ctrl+L clears the visible transcript while preserving cwd, command history, `nextTranscriptEntryId`, current draft, and caret position. It does not run the `clear` command and does not call `console.clear()`.
- Ctrl+A moves the caret to the beginning of the input.
- Ctrl+E moves the caret to the end of the input.
- Plain Home and End move the collapsed caret to the beginning and end. Shift+Home/End and other modified variants retain browser-native selection behavior.
- Delete, Backspace, Ctrl+C, Ctrl+X, and Ctrl+V retain browser-native input editing and clipboard behavior. Ctrl+C is copy, not SIGINT; transcript text is selectable and copied natively without a button or Clipboard API.
- Escape clears visible completion candidates and leaves the draft unchanged.
- ArrowUp and ArrowDown clear stale completion candidates before navigating command history.

If the current cwd node becomes unavailable, the current prompt may display `(unavailable)` until the next command. The Shell core then performs its normal fallback and emits a `system` warning in the transcript.

## Safety Boundary

The Shell core does not import React, Window Manager, Application Runtime, `child_process`, or `node:fs`. Konsole UI may import React and Shell core, but it does not import real process or filesystem APIs. Neither layer uses `eval`, the `Function` constructor, browser storage, `navigator.clipboard`, or real file system APIs.

Konsole renders Shell output as plain text. It does not use `dangerouslySetInnerHTML`, `innerHTML`, iframes, Markdown parsing, ANSI interpretation, linkification, or script execution.

## Later Work

Future phases may add ANSI support, `rm`, `tee`, recursive grep, additional literal text tools, Restore To, force flags, interactive prompts, Undo, multiple sessions, tabs, split views, option completion, or more Unix-like features. This phase intentionally avoids synthetic POSIX metadata, tree options and summaries, regular expressions, glob expansion, `find -exec`, scripts, pipelines, redirection, real processes, persistence, overwrite prompts, fuzzy search, Ctrl+R, history expansion, SIGINT, and candidate selection menus.
