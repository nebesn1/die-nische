# Virtual File System

Phase 3.1 introduces a pure TypeScript, in-memory virtual file system. It is shared through `VfsProvider`.

Phase 3.2 makes Konqueror the first VFS consumer. Phase 3.3 adds the first Konqueror write commands: New Folder, New Text File, and Rename. Phase 3.4 adds basic UTF-8 text editing with Save and Discard Changes. Phase 3.6 consumes the Move, Copy, and Move to Trash APIs for single selected items and adds read-only Trash browsing. Phase 3.7 consumes Restore, Delete Permanently, and Empty Trash for top-level Trash entries and adds desktop Home/Trash launch intents. Phase 4.1 adds a Shell core as the second VFS consumer for read-only query commands. Phase 4.6 adds atomic text append through VFS and Provider so Konsole content commands share state with Konqueror. Multi-select, drag-and-drop, Undo, Restore To, shell redirection, pipes, and persistence are still not implemented.

## Initial Tree

The initial state is deterministic and recreated on page refresh:

```text
/
├── home/
│   └── user/
│       ├── Desktop/
│       ├── Documents/
│       │   ├── Welcome.md
│       │   └── Notes.txt
│       ├── Downloads/
│       ├── Music/
│       ├── Pictures/
│       └── Videos/
├── media/
│   ├── cdrom/
│   └── floppy/
└── trash/
```

`Welcome.md` and `Notes.txt` contain project-original text. Device and trash directories are ordinary directories in this phase.

## Data Model

`VfsNode` is a discriminated union:

```ts
type VfsNode = VfsDirectoryNode | VfsTextFileNode | VfsAssetUrlFileNode;
```

Directories store ordered `childIds`. Text files store UTF-8 text content; asset files store an external asset URL. Both store MIME type, encoding, and byte size. Nodes do not store paths; paths are derived from `parentId` links. Repository audio and video use the same asset boundary as images: `.mp3` is `audio/mpeg`, `.ogg`/`.oga` are `audio/ogg`, `.wav` is `audio/wav`, `.mp4` is `video/mp4`, `.webm` is `video/webm`, and `.ogv` is `video/ogg`. The standard `/home/user/Videos` directory is a normal protected Home mount; its children remain generic VFS nodes.

`VfsState` stores:

- `rootId`
- `nodesById`
- `specialLocations`
- `nextNodeSequence`
- `revision`

New node ids are deterministic, for example `vfs-node-0010`.

## Paths

VFS paths are POSIX-style and case-sensitive.

- `/` is root.
- Multiple slashes collapse to one.
- `.` is removed.
- `..` walks to the parent and stays at root when already at root.
- Relative paths require an absolute cwd.
- Empty paths resolve to cwd.
- Windows drive paths and backslashes are invalid.
- `~`, environment variables, URL decoding, and mount syntax are not supported.

Examples:

```ts
normalizeVfsPath("//home/user/./Documents/");
// ok: "/home/user/Documents"

normalizeVfsPath("../Downloads", "/home/user/Documents");
// ok: "/home/user/Downloads"
```

## Queries

Queries are pure and return `VfsResult<T>`:

- `getVfsNodeById(state, nodeId)`
- `resolveVfsPath(state, path, cwd?)`
- `getVfsPathForNode(state, nodeId)`
- `listVfsDirectory(state, path, cwd?)`
- `readVfsTextFile(state, path, cwd?)`
- `getVfsTrashEntry(state, nodeId)`
- `listVfsTrashEntries(state)`

Directory listing follows `childIds` order and does not sort. UI sorting belongs to later Konqueror work.

## Konqueror Browser

Konqueror starts at `state.specialLocations.home` and derives the visible path with `getVfsPathForNode`.

Supported navigation and read behavior:

- Back and Forward through component-local history.
- Up to parent directory.
- Home to the Home special location.
- Reload from the current VFS state.
- Absolute path navigation such as `/home/user/Documents`.
- Relative path navigation from the current directory, or from a file's parent directory.
- Directory listing with the original `childIds` order.
- Single selection in directory lists.
- Double click or Enter to open directories and text files.
- Read-only text display using a plain `<pre>`.
- Asset files remain listable and expose their stored MIME and original byte size, but are not decoded as text or played by Konqueror.
- Navigation errors shown inside Konqueror without replacing the current valid view.

History stores VFS node ids, not copied nodes. If a future VFS mutation changes a node's path, Konqueror can derive the new path from the node id and parent chain.

Supported write behavior:

- New Folder creates a directory in the current directory.
- New Text File creates an empty UTF-8 text file with MIME `text/plain`.
- Rename changes the selected directory item or the currently viewed text file.
- UTF-8 text files can be opened in an edit mode inside Konqueror.
- Save writes the current text draft through `VfsProvider.writeTextFile`.
- Save updates `content`, UTF-8 byte `size`, and `modifiedAt`; it preserves node id, parent id, created time, and child order.
- Saving identical content is a VFS no-op and does not increment `revision`.
- Discard Changes drops the local Konqueror draft and does not call a VFS mutation.
- Names are not trimmed and illegal characters are not replaced.
- Same-directory duplicate names are rejected with `ALREADY_EXISTS`.
- New text files do not receive an automatic `.txt` extension.
- Rename keeps the same node id, parent id, and child order.
- Same-name rename is a successful no-op and does not increment `revision`.
- Konqueror command dialogs keep mutation errors local to the dialog.
- Mutation success is committed through `VfsProvider`; Konqueror re-queries the shared state after `revision` changes.
- Phase 3.6 wires single-item Copy, Cut, Paste, Move to Trash, and read-only Trash navigation to Konqueror toolbar buttons and local shortcuts.
- Konqueror keeps its own one-item clipboard with stable node ids; it does not use the system clipboard.
- Copy Paste calls `copyNode`, keeps the clipboard, and selects the newly copied root.
- Cut Paste calls `moveNode`, clears the clipboard on success, and selects the moved node.
- Same-directory Cut Paste follows the VFS no-op rule: no duplicate, no reordering, no revision increment, and clipboard clears.
- Conflicting Paste returns `ALREADY_EXISTS`; Konqueror shows an inline operation error and does not auto-rename or overwrite.
- Move to Trash uses a Konqueror-internal confirmation dialog and calls `moveNodeToTrash`; successful Trash moves clear selection and clear clipboard if it pointed at the moved subtree.
- The canonical Trash backend is `/home/user/.local/share/Trash/files`; `/trash` is absent from the VFS tree. Konqueror presents that same stable directory node as `trash:/` through the normal navigation reducer and toolbar Trash button.
- Trash browsing is read-only. Konqueror can enter Trash directories and view text files there, but create, rename, edit, clipboard operations, and Move to Trash are disabled.
- The desktop Trash icon also opens Konqueror at `trash:/`. Its empty/full presentation is derived from the shared VFS Trash directory.
- Home desktop, QuickLaunch, and K Menu entries explicitly create a new Konqueror at the Home special location through an application launch intent. Plain Konqueror launchers likewise use their own explicit Start Page intent; only an ordinary Runtime request reuses the planner-selected existing instance.
- Trash root rows show Original Location and Deleted columns from `VfsTrashEntry`. Original Location is resolved from `originalParentId`; unavailable parents display `Unavailable`.
- Restore is available only for selected top-level Trash entries and calls `restoreNodeFromTrash`. It stays at `trash:/`, clears selection on success, and surfaces name conflicts or unavailable original folders inline.
- Delete Permanently is available only for selected top-level Trash entries and requires a Konqueror confirmation dialog before calling `deleteNodePermanently`.
- Empty Trash is available only at the non-empty Trash root and requires a confirmation dialog before calling `emptyTrash`.
- Permanent delete and Empty Trash prune deleted node ids from Konqueror navigation history so Back/Forward cannot navigate into removed nodes.
- Trash subdirectories remain read-only browse targets. Restore, Delete Permanently, and Empty Trash are disabled outside the Trash root.

## Shell and Konsole Consumers

The Shell core reads the same shared VFS state through public query APIs, and Konsole is now both a read and write consumer for the supported Shell commands. Konsole uses `useVfs()` and passes the latest `VfsState` plus a Provider-backed mutation port into Shell execution for each submitted command.

Supported read commands:

- `pwd` derives the current path from the session `cwdNodeId` with `getVfsPathForNode`.
- `cd [path]` uses VFS path resolution and changes only Shell session state.
- `ls [path]` uses `listVfsDirectory` for directories and `resolveVfsPath` for file basename output.
- `cat <path>` uses `readVfsTextFile` and outputs raw UTF-8 text content.
- `cat`, `head`, `tail`, `wc`, `grep`, and text-edit APIs reject asset-backed files through the typed content boundary; asset URLs are never decoded or searched as text.
- `echo` writes stdout only and does not use VFS.
- `head` and `tail` use `readVfsTextFile`, preserve LF, CRLF, and lone CR line endings, and do not change VFS revision.
- `wc` and `grep` use `readVfsTextFile` for current UTF-8 content; `wc` uses the shared UTF-8 byte-size helper and `grep` preserves source line terminators.
- `find` resolves its start node and recursively consumes only public node, canonical-path, and directory-listing queries. It keeps no index in VFS and emits the current tree's canonical paths.
- `stat` consumes public resolution, node, canonical-path, and directory-listing queries to report only stored node metadata. `tree` shares the public-query traversal used by `find` and renders the current node tree without storing a cache or index.
- `help` and `clear` operate only on Shell state.

Supported write commands:

- `mkdir <path>` calls Provider `createDirectory`.
- `touch <path>` calls Provider `createTextFile` for missing files and treats existing files as a no-op.
- `append <path> <text...>` calls Provider `appendTextFile`, appending one LF-terminated text line to an existing non-Trash text file.
- `cp <source> <destination>` calls Provider `copyNode` and uses VFS recursive copy semantics.
- `mv <source> <destination>` calls Provider `moveNode` and preserves stable node ids.
- `trash <path>` calls Provider `moveNodeToTrash` and uses VFS Trash metadata and conflict naming.
- `restore <trash-entry>` calls Provider `restoreNodeFromTrash` for top-level Trash entries. VFS owns original parent checks, conflict checks, metadata removal, and original name restoration.
- `permanent-delete --confirm <trash-entry>` calls Provider `deleteNodePermanently` and removes the full Trash entry subtree. Without `--confirm`, Shell prints a warning and does not call Provider.
- `empty-trash --confirm` calls Provider `emptyTrash`, removes all Trash entries and descendants, and preserves the Trash root. Without `--confirm`, Shell prints a warning and does not call Provider.

Shell sessions store cwd as a VFS node id, not as a permanent path string. If another VFS consumer deletes or invalidates the cwd, command execution falls back to Home, then root, and emits a controlled warning. Valid Trash paths remain accessible for read-only commands.

Read-only Shell commands, including `wc`, `grep`, `find`, `stat`, and `tree`, do not call VFS mutations and do not change `revision`, `nodesById`, `childIds`, or Trash metadata. Search and inspection execution receive the latest state and store no VFS snapshot, index, or synthetic POSIX metadata. Successful Shell write commands update the same Provider state that Konqueror uses, so Konqueror and the desktop Trash icon reflect the change immediately after React receives the Provider update. `append` updates file `content`, UTF-8 byte `size`, and `modifiedAt` while preserving id, parent id, `createdAt`, MIME, encoding, and directory order.

Konqueror can create, save, rename, move, trash, restore, or delete files, and the next Konsole command reads the updated shared VFS state. Konsole can create, append, copy, move, trash, restore, permanently delete, and empty Trash through Provider commands, and Konqueror reads those same VFS changes without a separate store. Konqueror saves are visible to the next Shell `cat`, `head`, `tail`, or `append` command because Konsole passes the latest Provider state and commands for every submitted command. Multi-line pasted mutation commands use the same Provider operations one queue item at a time, so each following item reads the preceding committed state.

Unconfirmed Shell destructive commands do not call VFS mutations and do not change `revision`. Confirmed permanent delete and confirmed empty Trash follow the VFS mutation revision rules; confirmed empty Trash on an already empty Trash directory is a no-op.

Shell completion is another read-only VFS consumer. Each Tab completion reads the caller's latest `VfsState` through public query APIs such as path resolution and directory listing, displays candidates from command registry order or directory `childIds` order, and never changes `revision`.

The Shell does not access the host file system, browser File System Access API, `localStorage`, IndexedDB, or real OS processes.

Konsole history and native keyboard/selection usability are VFS-independent. The `history` command only reads `ShellSessionState.commandHistory` and does not change VFS revision.

## Mutations

Mutations are pure and return `VfsMutationResult<T>`:

- `createVfsDirectory(state, parentPath, name, { now })`
- `createVfsTextFile(state, parentPath, name, content, { now, mimeType? })`
- `writeVfsTextFile(state, path, content, { now })`
- `appendVfsTextFile(state, path, text, { now })`
- `renameVfsNode(state, path, newName, { now })`
- `moveVfsNode(state, sourcePath, destinationDirectoryPath, { now, newName? })`
- `copyVfsNode(state, sourcePath, destinationDirectoryPath, { now, newName? })`
- `moveVfsNodeToTrash(state, sourcePath, { now })`
- `restoreVfsNodeFromTrash(state, nodeId, { now })`
- `deleteVfsNodePermanently(state, nodeId, { now })`
- `emptyVfsTrash(state, { now })`

Successful mutations return a new state, increment `revision`, and copy only changed nodes. Failed mutations return the original state reference. Writing identical text is a deterministic no-op.

Append:

- `appendVfsTextFile` resolves the path to an existing UTF-8 text file and atomically computes `oldContent + text` from the provided latest state.
- Directories fail with `IS_DIRECTORY`; missing paths fail with `NOT_FOUND`.
- UTF-8 byte `size` is recalculated with the shared encoding helper.
- `modifiedAt` uses the injected timestamp. `createdAt`, node id, parent id, MIME, encoding, parent `childIds`, Trash metadata, and `nextNodeSequence` are preserved.
- Successful non-empty append increments `revision` once. Empty append text is a successful no-op that returns the original state and does not update `modifiedAt`.
- Provider exposes this as `appendTextFile(path, text, { now })`; callers do not pass `nodesById` or replace state directly.

Move:

- Source and destination are resolved with normal VFS path rules.
- Destination must be a directory and cannot be Trash or inside Trash.
- Root and protected special locations cannot be moved.
- Nodes already inside Trash cannot be moved by regular Move.
- A directory cannot be moved into itself or one of its descendants.
- `newName` is optional. Without it, the original name is retained.
- Same-directory same-name Move is a no-op. Same-directory Move with a different `newName` is equivalent to Rename and preserves child order.
- Cross-directory Move appends the node to the destination directory and preserves node ids, subtree ids, file content, size, and created time.

Copy:

- Root and Trash root cannot be copied.
- Destination must be a normal directory outside Trash.
- A directory cannot be copied into itself or one of its descendants.
- Every copied node receives a new deterministic id. Allocation is depth-first: root first, then children in source `childIds` order.
- Copied file content, UTF-8 size, encoding, and MIME are preserved.
- Copied nodes use the injected timestamp for both `createdAt` and `modifiedAt`.
- Failed Copy does not consume ids or leave partial nodes.

Trash:

- `VfsTrashEntry` metadata is stored in `trashEntriesByNodeId` and only exists for direct Trash children.
- Moving to Trash preserves the node id and subtree ids, records `originalParentId`, `originalName`, and `trashedAt`, and appends the node to `/home/user/.local/share/Trash/files`.
- Trash names are kept unique with deterministic suffixes such as `Report (1).txt`; `originalName` is not changed.
- Protected special locations cannot be moved to Trash.
- Normal create, move, and copy cannot create Trash children or descendants without metadata. Paste into the canonical Trash backend or any directory inside Trash is rejected with `INVALID_DESTINATION`.

Restore:

- Restore only accepts a top-level Trash entry id.
- The original parent must still exist, be a directory, and not be inside Trash.
- The original parent must not already contain `originalName`.
- Restore removes Trash metadata, restores the original name and parent id, and appends the node to the original parent.
- Restore never overwrites and never chooses a fallback destination.

Permanent Delete and Empty Trash:

- Permanent delete accepts only a top-level Trash entry id and removes that full subtree from `nodesById`.
- `deletedNodeIds` are returned in root-first depth-first order.
- Empty Trash deletes every direct Trash child and descendant, clears all Trash metadata, and keeps the Trash root node.
- Empty Trash on an empty Trash directory is a successful no-op.

Protected special locations:

- Root, Home, Desktop, Documents, Downloads, Music, Pictures, Videos, Trash, CD-ROM, and Floppy are protected from Move, Trash, and permanent delete.
- Rename is not broadened by this phase; existing Rename behavior is left unchanged.

## Errors

Expected failures use result objects rather than thrown exceptions:

- `INVALID_PATH`
- `INVALID_NAME`
- `NOT_FOUND`
- `NOT_DIRECTORY`
- `IS_DIRECTORY`
- `ALREADY_EXISTS`
- `ROOT_OPERATION_FORBIDDEN`
- `INVALID_DESTINATION`
- `SPECIAL_LOCATION_OPERATION_FORBIDDEN`
- `ALREADY_IN_TRASH`
- `NOT_IN_TRASH`
- `RESTORE_TARGET_UNAVAILABLE`

These errors are application-facing data for future Konqueror or Konsole UI. They are not logged globally.

## Invariants

`validateVfsState(state)` checks:

- root exists, is a directory, and has no parent
- non-root nodes have parents
- parent ids point to directories
- child ids exist and point back to their directory
- no duplicate child ids or sibling names
- every node is reachable from root
- no parent cycles
- all special locations exist and are directories
- Trash metadata points to direct Trash children
- every direct Trash child has metadata
- non-direct Trash nodes do not carry top-level metadata
- Trash entry original names are valid
- file size matches UTF-8 byte length
- `nextNodeSequence` will not generate an existing id

This function is for tests and diagnostics, not per-query validation.

## React Provider

`VfsProvider` lazily creates a fresh initial state and exposes shared VFS commands through `useVfs`.

The provider is mounted above the desktop/application providers, so all future applications see the same VFS instance. Closing an application window does not reset VFS state. Refreshing the page resets it.

## KWrite Consumer

KWrite is a shared-VFS UTF-8 text-file consumer and writer. It obtains the current file through public node and path queries, stores only a stable node id plus a local baseline for conflict detection, and saves through Provider commands. It does not read `nodesById` directly or commit VFS state itself.

- Stable ids continue to identify a document across Rename, Move, Trash, and Restore; KWrite derives the current canonical path at render and save time.
- KWrite scopes external-change detection to its current node's text content and uniform line-ending convention. `modifiedAt` is refreshed as baseline metadata for relocation-only changes, so unrelated revisions and Rename/Move/Trash/Restore lifecycle timestamps do not conflict.
- A Provider save preserves the normal text-file invariants: UTF-8 size calculation, node id, parent id, created time, and normal write revision behavior.
- Uniform LF, CRLF, and lone-CR files are serialized back using their original convention. Mixed-ending files are read-only in KWrite rather than being normalized destructively.
- Ordinary Save uses `writeTextFile`. Save As creates the destination through the atomic `createTextFile(parentPath, name, content)` Provider command when it does not exist, or writes an explicitly confirmed existing text-file target by its current path. Both routes preserve the VFS-owned UTF-8 byte size and timestamps; creation has one revision and one new stable node id.
- KWrite validates Save As basenames with the shared `validateVfsNodeName` helper. It does not create files in Trash, does not use a native file picker, and rechecks collisions against the latest Provider state before creating or replacing.
- An empty Save As filename field is invalid. Literal quote characters, including a two-character name `""`, remain valid under the existing POSIX-like VFS name rules; KWrite does not add a quote-specific restriction.
- KWrite Open / Save As dialogs are read-only VFS consumers until an explicit Save / Replace action calls the Provider. They retain no VFS snapshot or file index.
- KWrite still has no private VFS store, direct mutation path, real filesystem access, persistence, or multi-document support. Its Runtime close guard decides only whether to retain or Save As-rescue the local draft; all successful writes still use the same Provider commands.

## Not Implemented

This phase does not implement multi-select, drag-and-drop, right-click menus, Restore To, undo/redo, Save As, binary files, uploads, downloads, persistence, real disk access, mounted device behavior, permissions, symlinks, shell mutation commands, or real shell process access.
