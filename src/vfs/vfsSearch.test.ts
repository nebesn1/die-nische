import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import { createVfsDirectory, createVfsTextFile, deleteVfsNodePermanently, moveVfsNode, moveVfsNodeToTrash, renameVfsNode, writeVfsTextFile } from "./mutations";
import type { VfsFileNode, VfsState } from "./types";
import { createVfsTestStateWithoutRepositoryContent } from "./testFixtures";
import {
  getVfsSearchResultMetadata,
  findVfsFirstMatchingLine,
  hasVfsTextSearchQuery,
  matchesVfsSearchFileType,
  matchesVfsSearchSizeFilter,
  matchesVfsSearchTimeRange,
  matchesVfsNamePattern,
  matchesVfsTextContent,
  normalizeVfsSearchFileType,
  searchVfs,
  type VfsSearchQuery,
} from "./vfsSearch";

const now = "2026-08-11T00:00:00.000Z";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) throw new Error("Expected VFS mutation to succeed");
  return { state: result.state, value: result.value };
};

const expectSearch = (state: VfsState, partial: Partial<VfsSearchQuery> = {}) => {
  const result = searchVfs(state, {
    rootNodeId: state.specialLocations.home,
    namePattern: "*",
    includeSubdirectories: true,
    fileType: "all",
    containingText: "",
    nameCaseSensitive: false,
    contentsCaseSensitive: false,
    timeRange: null,
    sizeFilter: null,
    ...partial,
  });

  if (!result.ok) throw new Error(`Expected search to succeed: ${result.error.code}`);
  return result.value;
};

describe("VFS search wildcard matching", () => {
  it("matches empty patterns as all names and applies whole-name matching only to wildcard patterns", () => {
    expect(matchesVfsNamePattern("Notes.txt", "")).toBe(true);
    expect(matchesVfsNamePattern("Notes.txt", "*")).toBe(true);
    expect(matchesVfsNamePattern("Notes.txt", "*.txt")).toBe(true);
    expect(matchesVfsNamePattern("Notes.txt.bak", "*.txt")).toBe(false);
    expect(matchesVfsNamePattern("test1.txt", "test?.txt")).toBe(true);
    expect(matchesVfsNamePattern("test12.txt", "test?.txt")).toBe(false);
    expect(matchesVfsNamePattern("abc", "a**c")).toBe(true);
  });

  it("uses case-insensitive literal substring matching when a pattern has no wildcard", () => {
    expect(matchesVfsNamePattern("README.old", "README")).toBe(true);
    expect(matchesVfsNamePattern("MyREADME", "README")).toBe(true);
    expect(matchesVfsNamePattern("[Plan](1).txt", "[Plan](?).txt")).toBe(true);
    expect(matchesVfsNamePattern("a[b].txt", "[")).toBe(true);
    expect(matchesVfsNamePattern("a[b].txt", "]")).toBe(true);
    expect(matchesVfsNamePattern("a(1).txt", "(")).toBe(true);
    expect(matchesVfsNamePattern("a+b.txt", "+")).toBe(true);
    expect(matchesVfsNamePattern("a+b.txt", ".")).toBe(true);
    expect(matchesVfsNamePattern("a^${x}|.txt", "^")).toBe(true);
    expect(matchesVfsNamePattern("a^${x}|.txt", "$")).toBe(true);
    expect(matchesVfsNamePattern("a^${x}|.txt", "{")).toBe(true);
    expect(matchesVfsNamePattern("a^${x}|.txt", "|")).toBe(true);
    expect(matchesVfsNamePattern("README", "readme")).toBe(true);
    expect(matchesVfsNamePattern("README", "readme", true)).toBe(false);
    expect(matchesVfsNamePattern("中文.txt", "中文")).toBe(true);
    expect(matchesVfsNamePattern("中文.txt", "中?.txt")).toBe(true);
  });
});

describe("VFS search canonical-name presentation boundary", () => {
  it("matches and orders canonical names even when result consumers render displayName", () => {
    const first = expectMutation(createVfsTextFile(createVfsTestStateWithoutRepositoryContent(), "/home/user/Documents", "a.md", "alpha", { now }));
    const second = expectMutation(createVfsTextFile(first.state, "/home/user/Documents", "z.md", "zulu", { now }));
    const a = second.state.nodesById[first.value.id];
    const z = second.state.nodesById[second.value.id];
    if (!a || !z) throw new Error("search fixtures missing");
    const state: VfsState = {
      ...second.state,
      nodesById: {
        ...second.state.nodesById,
        [a.id]: { ...a, displayName: "Zebra" },
        [z.id]: { ...z, displayName: "Alpha" },
      },
    };

    expect(expectSearch(state, {
      rootNodeId: state.specialLocations.documents,
      includeSubdirectories: false,
      namePattern: "*.md",
    }).map((result) => result.name)).toEqual(["a.md", "z.md"]);
    expect(expectSearch(state, {
      rootNodeId: state.specialLocations.documents,
      includeSubdirectories: false,
      namePattern: "Zebra",
    })).toEqual([]);
  });
});

describe("VFS search content matching", () => {
  it("uses literal substring matching with explicit case handling", () => {
    expect(matchesVfsTextContent("Robot robot ROBOT", "robot")).toBe(true);
    expect(matchesVfsTextContent("Robot robot ROBOT", "Robot", true)).toBe(true);
    expect(matchesVfsTextContent("Robot robot ROBOT", "robot", true)).toBe(true);
    expect(matchesVfsTextContent("Robot robot ROBOT", "ROBOT", true)).toBe(true);
    expect(matchesVfsTextContent("Robot", "robot", true)).toBe(false);
    expect(matchesVfsTextContent("[literal]", "[literal]", true)).toBe(true);
    expect(matchesVfsTextContent("hello \u4e16\u754c", "\u4e16\u754c", true)).toBe(true);
  });

  it("treats whitespace-only content text as inactive and derives a compact first matching line", () => {
    expect(hasVfsTextSearchQuery(" ")).toBe(false);
    expect(findVfsFirstMatchingLine("hello\r\nrobot world\r\nrobot again", "robot")).toBe("robot world");
    expect(findVfsFirstMatchingLine("Robot", "robot", true)).toBeNull();
    expect(findVfsFirstMatchingLine("Robot", "robot")).toBe("Robot");
    expect(findVfsFirstMatchingLine("x".repeat(200), "x")).toHaveLength(160);
  });
});

describe("VFS search traversal and live metadata", () => {
  it("finds asset-backed files by name while never searching their asset URL as text", () => {
    const initial = createInitialVfsState();
    const documents = initial.nodesById[initial.specialLocations.documents];
    if (!documents || documents.kind !== "directory") throw new Error("Documents fixture missing");
    const image: VfsFileNode = {
      id: "vfs-search-image",
      name: "Robot.png",
      parentId: documents.id,
      kind: "file",
      encoding: "utf-8",
      mimeType: "image/png",
      content: { kind: "asset-url", url: "/assets/robot-secret.png" },
      size: 1337,
      createdAt: now,
      modifiedAt: now,
    };
    const state: VfsState = {
      ...initial,
      nodesById: {
        ...initial.nodesById,
        [documents.id]: { ...documents, childIds: [...documents.childIds, image.id] },
        [image.id]: image,
      },
    };

    expect(expectSearch(state, { rootNodeId: documents.id, namePattern: "Robot", containingText: "" }).map((result) => result.nodeId)).toContain(image.id);
    expect(expectSearch(state, { rootNodeId: documents.id, namePattern: "*", containingText: "robot-secret" })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ nodeId: image.id })]),
    );
  });

  it("treats audio assets as filename-searchable files but never as searchable text", () => {
    const initial = createInitialVfsState();
    const documents = initial.nodesById[initial.specialLocations.documents];
    if (!documents || documents.kind !== "directory") throw new Error("Documents fixture missing");
    const audio: VfsFileNode = {
      id: "vfs-search-audio",
      name: "Voice.mp3",
      parentId: documents.id,
      kind: "file",
      encoding: "utf-8",
      mimeType: "audio/mpeg",
      content: { kind: "asset-url", url: "/assets/voice-secret.mp3" },
      size: 2048,
      createdAt: now,
      modifiedAt: now,
    };
    const state: VfsState = {
      ...initial,
      nodesById: {
        ...initial.nodesById,
        [documents.id]: { ...documents, childIds: [...documents.childIds, audio.id] },
        [audio.id]: audio,
      },
    };

    expect(expectSearch(state, { rootNodeId: documents.id, namePattern: "Voice.mp3" }).map((result) => result.nodeId)).toContain(audio.id);
    expect(expectSearch(state, { rootNodeId: documents.id, containingText: "voice-secret" })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ nodeId: audio.id })]),
    );
  });

  it("treats video assets as filename-searchable files but never as searchable text", () => {
    const initial = createInitialVfsState();
    const documents = initial.nodesById[initial.specialLocations.documents];
    if (!documents || documents.kind !== "directory") throw new Error("Documents fixture missing");
    const video: VfsFileNode = {
      id: "vfs-search-video",
      name: "Demo.MP4",
      parentId: documents.id,
      kind: "file",
      encoding: "utf-8",
      mimeType: "video/mp4",
      content: { kind: "asset-url", url: "/assets/video-secret.mp4" },
      size: 4096,
      createdAt: now,
      modifiedAt: now,
    };
    const state: VfsState = {
      ...initial,
      nodesById: {
        ...initial.nodesById,
        [documents.id]: { ...documents, childIds: [...documents.childIds, video.id] },
        [video.id]: video,
      },
    };

    expect(expectSearch(state, { rootNodeId: documents.id, namePattern: "demo.mp4" }).map((result) => result.nodeId)).toContain(video.id);
    expect(expectSearch(state, { rootNodeId: documents.id, fileType: "files", namePattern: "*.mp4" }).map((result) => result.nodeId)).toContain(video.id);
    expect(expectSearch(state, { rootNodeId: documents.id, fileType: "text-files", namePattern: "*" }).map((result) => result.nodeId)).not.toContain(video.id);
    expect(expectSearch(state, { rootNodeId: documents.id, containingText: "video-secret" })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ nodeId: video.id })]),
    );
  });

  it("searches direct children or recursive descendants deterministically, with directories first", () => {
    const initial = createInitialVfsState();
    const initialResults = expectSearch(initial, { rootNodeId: initial.specialLocations.documents })
      .map((result) => `${result.type}:${result.path}`);
    const project = expectMutation(createVfsDirectory(initial, "/home/user/Documents", "Project", { now }));
    const nested = expectMutation(createVfsTextFile(project.state, "/home/user/Documents/Project", "Robot.txt", "robot\r\ntext", { now }));
    const direct = expectMutation(createVfsTextFile(nested.state, "/home/user/Documents", "Alpha.txt", "Robot", { now }));

    const nonRecursive = expectSearch(direct.state, {
      rootNodeId: direct.state.specialLocations.documents,
      includeSubdirectories: false,
      containingText: "robot",
    });
    const recursive = expectSearch(direct.state, {
      rootNodeId: direct.state.specialLocations.documents,
      includeSubdirectories: true,
      containingText: "robot",
    });
    const all = expectSearch(direct.state, { rootNodeId: direct.state.specialLocations.documents });

    expect(nonRecursive.map((result) => result.name)).toEqual(["Alpha.txt"]);
    expect(recursive.map((result) => result.name)).toEqual(["Alpha.txt", "Robot.txt"]);
    const expectedFiles = [
      ...initialResults,
      "file:/home/user/Documents/Alpha.txt",
      "file:/home/user/Documents/Project/Robot.txt",
    ].sort();

    expect(all.map((result) => `${result.type}:${result.path}`)).toEqual([
      "directory:/home/user/Documents/Project",
      ...expectedFiles,
    ]);
  });

  it("combines filename and text filters, excludes directories from content matches, and uses UTF-8 byte size", () => {
    const created = expectMutation(createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "\u4e2d\u6587.txt", "\u673a\u5668\u4eba", { now }));
    const results = expectSearch(created.state, {
      rootNodeId: created.state.specialLocations.documents,
      namePattern: "*.txt",
      containingText: "\u673a\u5668\u4eba",
      nameCaseSensitive: true,
      contentsCaseSensitive: true,
    });

    expect(results).toEqual([expect.objectContaining({ name: "\u4e2d\u6587.txt", type: "file", size: 9 })]);
  });

  it("finds migrated repository documents by name and their text content without changing the candidate baseline", () => {
    const state = createInitialVfsState();

    expect(expectSearch(state, {
      rootNodeId: state.specialLocations.documents,
      includeSubdirectories: false,
      namePattern: "Welcome.md",
    })).toEqual([expect.objectContaining({ name: "Welcome.md", path: "/home/user/Documents/Welcome.md" })]);
    expect(expectSearch(state, {
      rootNodeId: state.specialLocations.documents,
      includeSubdirectories: false,
      containingText: "virtual in-memory file system",
    })).toEqual([expect.objectContaining({ name: "Welcome.md", path: "/home/user/Documents/Welcome.md" })]);
    expect(expectSearch(state, {
      rootNodeId: state.specialLocations.documents,
      includeSubdirectories: false,
      containingText: "browser memory for this prototype",
    })).toEqual([expect.objectContaining({ name: "Notes.txt", path: "/home/user/Documents/Notes.txt" })]);
  });

  it("does not expose repository metadata sidecars as VFS or KFind candidates", () => {
    const state = createInitialVfsState();

    expect(expectSearch(state, {
      rootNodeId: state.specialLocations.home,
      namePattern: ".kde3-meta.json",
    })).toEqual([]);
  });

  it("finds a production repository image by its current name without treating its asset URL as searchable text", () => {
    const state = createInitialVfsState();
    const image = Object.values(state.nodesById).find((node) =>
      node.kind === "file" && node.parentId === state.specialLocations.pictures && node.content.kind === "asset-url",
    );
    if (!image || image.kind !== "file" || image.content.kind !== "asset-url") throw new Error("Repository image fixture missing");

    expect(expectSearch(state, {
      rootNodeId: state.specialLocations.pictures,
      includeSubdirectories: false,
      namePattern: image.name,
    })).toEqual([expect.objectContaining({ name: image.name, type: "file" })]);
    expect(expectSearch(state, {
      rootNodeId: state.specialLocations.pictures,
      includeSubdirectories: false,
      containingText: image.content.url,
    })).toEqual([]);
  });

  it("filters current VFS nodes by coarse file type without a MIME database", () => {
    const project = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Project", { now }));
    const created = expectMutation(createVfsTextFile(project.state, "/home/user/Documents", "Robot.md", "robot", { now, mimeType: "text/markdown" }));
    const rootId = created.state.specialLocations.documents;
    const all = expectSearch(created.state, { rootNodeId: rootId, includeSubdirectories: false });
    const files = expectSearch(created.state, { rootNodeId: rootId, includeSubdirectories: false, fileType: "files" });
    const folders = expectSearch(created.state, { rootNodeId: rootId, includeSubdirectories: false, fileType: "folders" });
    const textFiles = expectSearch(created.state, { rootNodeId: rootId, includeSubdirectories: false, fileType: "text-files" });
    const projectNode = created.state.nodesById[project.value.id];

    expect(all.map((result) => result.type)).toContain("directory");
    expect(all.map((result) => result.type)).toContain("file");
    expect(files.every((result) => result.type === "file")).toBe(true);
    expect(folders.map((result) => result.name)).toEqual(["Project"]);
    expect(textFiles.every((result) => result.type === "file")).toBe(true);
    expect(projectNode).toBeDefined();
    if (!projectNode) throw new Error("Expected project directory");
    expect(matchesVfsSearchFileType(projectNode, "text-files")).toBe(false);
    expect(normalizeVfsSearchFileType("unknown")).toBe("all");
  });

  it("applies file type and literal contents filters as an AND composition", () => {
    const folder = expectMutation(createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "RobotFolder", { now }));
    const first = expectMutation(createVfsTextFile(folder.state, "/home/user/Documents", "robot.txt", "robot", { now }));
    const second = expectMutation(createVfsTextFile(first.state, "/home/user/Documents", "hello.txt", "hello", { now }));
    const rootId = second.state.specialLocations.documents;

    expect(expectSearch(second.state, { rootNodeId: rootId, fileType: "files", containingText: "robot" }).map((result) => result.name)).toEqual(["robot.txt"]);
    expect(expectSearch(second.state, { rootNodeId: rootId, fileType: "folders", containingText: "robot" })).toEqual([]);
    expect(expectSearch(second.state, { rootNodeId: rootId, fileType: "folders", containingText: "" }).map((result) => result.name)).toContain("RobotFolder");
  });

  it("accepts nodes whose real createdAt or modifiedAt falls inside an inclusive time range", () => {
    const created = expectMutation(createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "Changed.txt", "robot", { now: "2026-08-01T10:00:00.000Z" }));
    const changed = expectMutation(writeVfsTextFile(created.state, "/home/user/Documents/Changed.txt", "robot changed", { now: "2026-08-10T10:00:00.000Z" }));
    const directory = expectMutation(createVfsDirectory(changed.state, "/home/user/Documents", "Recent", { now: "2026-08-10T12:00:00.000Z" }));
    const future = expectMutation(createVfsTextFile(directory.state, "/home/user/Documents", "Future.txt", "robot", { now: "2026-08-10T12:00:00.001Z" }));
    const range = {
      startInclusiveMs: Date.parse("2026-08-10T10:00:00.000Z"),
      endInclusiveMs: Date.parse("2026-08-10T12:00:00.000Z"),
    };
    const matched = expectSearch(future.state, {
      rootNodeId: future.state.specialLocations.documents,
      includeSubdirectories: false,
      timeRange: range,
    });
    const changedNode = future.state.nodesById[changed.value.id];

    expect(matched.map((result) => result.name)).toEqual(["Recent", "Changed.txt"]);
    expect(changedNode).toBeDefined();
    if (!changedNode) throw new Error("Expected changed file");
    expect(matchesVfsSearchTimeRange(changedNode, range)).toBe(true);
    expect(matchesVfsSearchTimeRange(changedNode, {
      startInclusiveMs: Date.parse("2026-08-02T00:00:00.000Z"),
      endInclusiveMs: Date.parse("2026-08-09T23:59:59.999Z"),
    })).toBe(false);
  });

  it("applies exact UTF-8 byte size comparisons only to files", () => {
    const empty = expectMutation(createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "Empty.txt", "", { now }));
    const unicode = expectMutation(createVfsTextFile(empty.state, "/home/user/Documents", "Unicode.txt", "你", { now }));
    const directory = expectMutation(createVfsDirectory(unicode.state, "/home/user/Documents", "Folder", { now }));
    const rootId = directory.state.specialLocations.documents;
    const equalZero = expectSearch(directory.state, {
      rootNodeId: rootId,
      includeSubdirectories: false,
      sizeFilter: { comparator: "equal", thresholdBytes: 0 },
    });
    const atMostThree = expectSearch(directory.state, {
      rootNodeId: rootId,
      includeSubdirectories: false,
      sizeFilter: { comparator: "at-most", thresholdBytes: 3 },
    });
    const folder = directory.state.nodesById[directory.value.id];

    expect(equalZero.map((result) => result.name)).toEqual(["Empty.txt"]);
    expect(atMostThree.map((result) => result.name)).toEqual(["Empty.txt", "Unicode.txt"]);
    expect(expectSearch(directory.state, {
      rootNodeId: rootId,
      includeSubdirectories: false,
      sizeFilter: { comparator: "at-least", thresholdBytes: 3 },
    }).map((result) => result.name)).toContain("Unicode.txt");
    expect(folder).toBeDefined();
    if (!folder) throw new Error("Expected folder");
    expect(matchesVfsSearchSizeFilter(folder, { comparator: "at-most", thresholdBytes: 10 })).toBe(false);
  });

  it("combines Name, Contents, time, and size predicates without changing result order", () => {
    const first = expectMutation(createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "small.txt", "robot", { now: "2026-08-10T10:00:00.000Z" }));
    const second = expectMutation(createVfsTextFile(first.state, "/home/user/Documents", "large.txt", "robot".repeat(400), { now: "2026-08-10T10:00:00.000Z" }));
    const results = expectSearch(second.state, {
      rootNodeId: second.state.specialLocations.documents,
      includeSubdirectories: false,
      namePattern: "*.txt",
      containingText: "robot",
      timeRange: {
        startInclusiveMs: Date.parse("2026-08-10T00:00:00.000Z"),
        endInclusiveMs: Date.parse("2026-08-10T23:59:59.999Z"),
      },
      sizeFilter: { comparator: "at-most", thresholdBytes: 100 },
    });

    expect(results.map((result) => result.name)).toEqual(["small.txt"]);
    expect(results[0]?.firstMatchingLine).toBe("robot");
  });

  it("keeps literal name matching and content matching as an AND filter", () => {
    const first = expectMutation(createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "a[b].txt", "robot", { now }));
    const second = expectMutation(createVfsTextFile(first.state, "/home/user/Documents", "other.txt", "robot", { now }));
    const results = expectSearch(second.state, {
      rootNodeId: second.state.specialLocations.documents,
      namePattern: "[",
      containingText: "robot",
    });

    expect(results.map((result) => result.name)).toEqual(["a[b].txt"]);
  });

  it("reports unavailable and non-directory roots without searching a fallback location", () => {
    const state = createInitialVfsState();

    expect(searchVfs(state, {
      rootNodeId: "missing-node",
      namePattern: "*",
      includeSubdirectories: true,
      fileType: "all",
      containingText: "",
      nameCaseSensitive: false,
      contentsCaseSensitive: false,
      timeRange: null,
      sizeFilter: null,
    })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(searchVfs(state, {
      rootNodeId: "vfs-content-e594a065214576326cb903a5",
      namePattern: "*",
      includeSubdirectories: true,
      fileType: "all",
      containingText: "",
      nameCaseSensitive: false,
      contentsCaseSensitive: false,
      timeRange: null,
      sizeFilter: null,
    })).toMatchObject({ ok: false, error: { code: "NOT_DIRECTORY" } });
  });

  it("applies name and content case sensitivity independently in a combined query", () => {
    const created = expectMutation(createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "REPORT.TXT", "Robot", { now }));

    const nameInsensitiveContentSensitive = expectSearch(created.state, {
      rootNodeId: created.state.specialLocations.documents,
      namePattern: "*.txt",
      containingText: "robot",
      nameCaseSensitive: false,
      contentsCaseSensitive: true,
    });
    const bothInsensitive = expectSearch(created.state, {
      rootNodeId: created.state.specialLocations.documents,
      namePattern: "*.txt",
      containingText: "robot",
      nameCaseSensitive: false,
      contentsCaseSensitive: false,
    });

    expect(nameInsensitiveContentSensitive.map((result) => result.name)).not.toContain("REPORT.TXT");
    expect(bothInsensitive.map((result) => result.name)).toContain("REPORT.TXT");
  });

  it("keeps result identity stable while deriving renamed and moved metadata from the latest VFS state", () => {
    const initial = createInitialVfsState();
    const snapshot = expectSearch(initial, { rootNodeId: initial.specialLocations.documents });
    const noteId = snapshot.find((result) => result.name === "Notes.txt")?.nodeId;
    if (!noteId) throw new Error("Expected Notes.txt search result");

    const renamed = expectMutation(renameVfsNode(initial, "/home/user/Documents/Notes.txt", "Renamed.txt", { now }));
    const moved = expectMutation(moveVfsNode(renamed.state, "/home/user/Documents/Renamed.txt", "/home/user/Downloads", { now }));
    const metadata = getVfsSearchResultMetadata(moved.state, noteId);

    expect(metadata).toMatchObject({
      ok: true,
      value: { nodeId: noteId, name: "Renamed.txt", path: "/home/user/Downloads/Renamed.txt", parentPath: "/home/user/Downloads" },
    });
  });

  it("allows result consumers to drop permanently deleted snapshot ids while a new query discovers new files", () => {
    const initial = createInitialVfsState();
    const snapshot = expectSearch(initial, { rootNodeId: initial.specialLocations.documents });
    const noteId = snapshot.find((result) => result.name === "Notes.txt")?.nodeId;
    if (!noteId) throw new Error("Expected Notes.txt search result");
    const trashed = expectMutation(moveVfsNodeToTrash(initial, "/home/user/Documents/Notes.txt", { now }));
    const deleted = expectMutation(deleteVfsNodePermanently(trashed.state, noteId, { now }));
    const added = expectMutation(createVfsTextFile(deleted.state, "/home/user/Documents", "Later.txt", "new", { now }));

    expect(getVfsSearchResultMetadata(added.state, noteId)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(snapshot.map((result) => result.name)).not.toContain("Later.txt");
    expect(expectSearch(added.state, { rootNodeId: added.state.specialLocations.documents }).map((result) => result.name)).toContain("Later.txt");
  });
});
