import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import {
  createVfsDirectory,
  createVfsLinks,
  deleteVfsNodePermanently,
  moveVfsNode,
  moveVfsNodeToTrash,
  renameVfsNode,
  restoreVfsNodeFromTrash,
} from "../../vfs/mutations";
import { createInitialKonquerorNavigationState, getCurrentKonquerorLocationTarget, konquerorNavigationReducer } from "./navigationState";
import {
  findKonquerorHistoryTarget,
  formatKonquerorNavigationError,
  getKonquerorCurrentPath,
  getKonquerorExternalWebParentUrl,
  getKonquerorParentDirectoryNodeId,
  getKonquerorView,
  resolveKonquerorAbsoluteLocationTarget,
  resolveKonquerorAbsoluteDirectoryLocation,
  resolveKonquerorLocation,
  resolveKonquerorNodeId,
} from "./navigationController";
import { getKonquerorCaption } from "./konquerorCaption";
import { createKonquerorAboutLocationTarget, createKonquerorBlankLocationTarget } from "./navigationTypes";

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected ok result");
  }

  return result.value;
};

describe("Konqueror navigation controller", () => {
  it("uses displayName for captions while retaining canonical file navigation", () => {
    const initial = createInitialVfsState();
    const file = initial.nodesById["vfs-content-e594a065214576326cb903a5"];
    if (!file || file.kind !== "file") throw new Error("file fixture missing");
    const state = { ...initial, nodesById: { ...initial.nodesById, [file.id]: { ...file, displayName: "My Notes" } } };

    expect(getKonquerorCaption(state, { type: "file", nodeId: file.id, previewerId: "embedded-text" })).toBe("My Notes - Konqueror");
    expect(resolveKonquerorAbsoluteLocationTarget(state, "/home/user/Documents/Notes.txt")).toMatchObject({ ok: true, value: { target: { type: "file", nodeId: file.id } } });
    expect(resolveKonquerorAbsoluteLocationTarget(state, "/home/user/Documents/My Notes")).toMatchObject({ ok: false });
  });

  it("resolves an exact Link through stable identity without enabling intermediate path traversal", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Folder", {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!folder.ok) throw new Error("Folder fixture failed");
    const linked = createVfsLinks(folder.state, "vfs-downloads", [folder.value.id], {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!linked.ok) throw new Error("Link fixture failed");
    const linkPath = "/home/user/Downloads/Folder";

    expect(expectOk(resolveKonquerorAbsoluteDirectoryLocation(linked.state, linkPath))).toMatchObject({
      node: { id: folder.value.id, kind: "directory" },
      path: "/home/user/Documents/Folder",
    });
    expect(resolveKonquerorAbsoluteDirectoryLocation(linked.state, `${linkPath}/child`)).toMatchObject({
      ok: false,
      error: { code: "NOT_DIRECTORY" },
    });
  });

  it("derives external HTTPS parents without changing the origin authority", () => {
    expect(getKonquerorExternalWebParentUrl({ type: "external-web", canonicalUrl: "https://example.com/a/b/" })).toBe(
      "https://example.com/a/",
    );
    expect(getKonquerorExternalWebParentUrl({ type: "external-web", canonicalUrl: "https://example.com/a/b" })).toBe(
      "https://example.com/a/",
    );
    expect(getKonquerorExternalWebParentUrl({ type: "external-web", canonicalUrl: "https://example.com/a/" })).toBe(
      "https://example.com/",
    );
    expect(getKonquerorExternalWebParentUrl({ type: "external-web", canonicalUrl: "https://user:pass@example.com:8443/a?x=1#section" })).toBe(
      "https://user:pass@example.com:8443/",
    );
    expect(getKonquerorExternalWebParentUrl({ type: "external-web", canonicalUrl: "https://www.example.com/" })).toBeNull();
  });

  it("resolves absolute directory and file paths through VFS", () => {
    const vfsState = createInitialVfsState();
    const navigationState = createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user");

    expect(expectOk(resolveKonquerorLocation(vfsState, navigationState, "/home/user/Documents")).path).toBe(
      "/home/user/Documents",
    );
    expect(expectOk(resolveKonquerorLocation(vfsState, navigationState, "/home/user/Documents/Welcome.md")).path).toBe(
      "/home/user/Documents/Welcome.md",
    );
  });

  it("resolves relative paths from directory cwd", () => {
    const vfsState = createInitialVfsState();
    const navigationState = createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user");

    expect(expectOk(resolveKonquerorLocation(vfsState, navigationState, "Documents/Welcome.md")).node.id).toBe(
      "vfs-content-76cff3ce17d8a853403179f1",
    );
    expect(expectOk(resolveKonquerorLocation(vfsState, navigationState, "../user/Downloads")).node.id).toBe(
      "vfs-downloads",
    );
  });

  it("resolves relative paths from file dirname", () => {
    const vfsState = createInitialVfsState();
    const navigationState = createInitialKonquerorNavigationState(
      "vfs-content-76cff3ce17d8a853403179f1",
      "/home/user/Documents/Welcome.md",
    );

    expect(expectOk(resolveKonquerorLocation(vfsState, navigationState, "Notes.txt")).node.id).toBe("vfs-content-e594a065214576326cb903a5");
    expect(expectOk(resolveKonquerorLocation(vfsState, navigationState, "../Downloads")).node.id).toBe(
      "vfs-downloads",
    );
  });

  it("returns errors without changing the current node", () => {
    const vfsState = createInitialVfsState();
    const navigationState = createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user");

    expect(resolveKonquerorLocation(vfsState, navigationState, "/missing")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(resolveKonquerorLocation(vfsState, navigationState, "C:\\Users\\aoi")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH" },
    });
    expect(resolveKonquerorLocation(vfsState, navigationState, "~")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("builds directory, file, empty directory, and missing-history views", () => {
    const vfsState = createInitialVfsState();
    const homeNavigation = createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user");
    const fileNavigation = createInitialKonquerorNavigationState("vfs-content-76cff3ce17d8a853403179f1", "/home/user/Documents/Welcome.md");
    const emptyNavigation = createInitialKonquerorNavigationState("vfs-downloads", "/home/user/Downloads");
    const brokenNavigation = createInitialKonquerorNavigationState("missing", "/missing");

    const homeView = getKonquerorView(vfsState, homeNavigation);
    const fileView = getKonquerorView(vfsState, fileNavigation);
    const emptyView = getKonquerorView(vfsState, emptyNavigation);
    const brokenView = getKonquerorView(vfsState, brokenNavigation);

    expect(homeView).toMatchObject({ type: "directory", path: "/home/user" });
    expect(homeView.type === "directory" ? homeView.children.map((node) => node.name) : []).toEqual([
      "Desktop",
      "Documents",
      "Downloads",
      "Music",
      "Pictures",
      "Videos",
    ]);
    expect(fileView).toMatchObject({ type: "file", path: "/home/user/Documents/Welcome.md" });
    expect(emptyView.type === "directory" ? emptyView.children : []).toEqual([]);
    expect(brokenView).toMatchObject({ type: "error", error: { code: "NOT_FOUND" } });
  });

  it("resolves direct node id targets and parent paths", () => {
    const vfsState = createInitialVfsState();
    const navigationState = createInitialKonquerorNavigationState(
      vfsState.specialLocations.documents,
      "/home/user/Documents",
    );

    expect(expectOk(resolveKonquerorNodeId(vfsState, "vfs-content-e594a065214576326cb903a5")).path).toBe("/home/user/Documents/Notes.txt");
    expect(getKonquerorParentDirectoryNodeId(vfsState, navigationState)).toBe(vfsState.specialLocations.home);
    expect(
      getKonquerorParentDirectoryNodeId(
        vfsState,
        createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user"),
      ),
    ).toBe("vfs-home");
    expect(
      getKonquerorParentDirectoryNodeId(
        vfsState,
        createInitialKonquerorNavigationState(vfsState.rootId, "/"),
      ),
    ).toBeNull();
  });

  it("resolves only absolute directory locations for the location bar", () => {
    const vfsState = createInitialVfsState();

    expect(expectOk(resolveKonquerorAbsoluteDirectoryLocation(vfsState, "/home/user/Documents/")).path).toBe(
      "/home/user/Documents",
    );
    expect(resolveKonquerorAbsoluteDirectoryLocation(vfsState, "Documents")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH", message: "Enter an absolute VFS path." },
    });
    expect(resolveKonquerorAbsoluteDirectoryLocation(vfsState, "/home/user/Documents/Notes.txt")).toMatchObject({
      ok: false,
      error: { code: "NOT_DIRECTORY" },
    });
    expect(expectOk(resolveKonquerorAbsoluteDirectoryLocation(vfsState, "/home/user/.local/share/Trash/files")).node.id).toBe(
      vfsState.specialLocations.trash,
    );
    expect(resolveKonquerorAbsoluteDirectoryLocation(vfsState, "/trash")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("keeps virtual and VFS locations ahead of the external HTTPS location parser", () => {
    const vfsState = createInitialVfsState();

    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(vfsState, "sysinfo:/"))).toEqual({
      target: { type: "sysinfo" },
      path: "sysinfo:/",
    });
    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(vfsState, "about:konqueror"))).toEqual({
      target: createKonquerorAboutLocationTarget("canonical"),
      path: "about:konqueror",
    });
    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(vfsState, "about:blank"))).toEqual({
      target: createKonquerorBlankLocationTarget(),
      path: "about:blank",
    });
    ["about:", "about:config", "about:konqueror/foo", "about://konqueror"].forEach((location) => {
      expect(resolveKonquerorAbsoluteLocationTarget(vfsState, location)).toMatchObject({
        ok: false,
        error: { code: "INVALID_PATH", message: "Unsupported location." },
      });
    });
    expect(resolveKonquerorAbsoluteLocationTarget(vfsState, "sysinfo:/devices")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH", message: "Unsupported location." },
    });
    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(vfsState, "https://www.example.com"))).toEqual({
      target: { type: "external-web", canonicalUrl: "https://www.example.com/" },
      path: "https://www.example.com/",
    });
    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(vfsState, "https://example.com/path?q=abc#section"))).toEqual({
      target: { type: "external-web", canonicalUrl: "https://example.com/path?q=abc#section" },
      path: "https://example.com/path?q=abc#section",
    });
    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(vfsState, "example.com"))).toEqual({
      target: { type: "external-web", canonicalUrl: "https://example.com/" },
      path: "https://example.com/",
    });
    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(vfsState, "www.example.com"))).toEqual({
      target: { type: "external-web", canonicalUrl: "https://www.example.com/" },
      path: "https://www.example.com/",
    });
    ["http://example.com", "javascript:alert(1)", "data:text/html,hello", "blob:https://example.com/id"].forEach((location) => {
      expect(resolveKonquerorAbsoluteLocationTarget(vfsState, location)).toMatchObject({
        ok: false,
        error: { code: "INVALID_PATH", message: "Unsupported location." },
      });
    });
    expect(resolveKonquerorAbsoluteLocationTarget(vfsState, "hello world")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH" },
    });
    expect(resolveKonquerorAbsoluteLocationTarget(vfsState, "file:///tmp")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH", message: "Unsupported location." },
    });
    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(vfsState, "/home/user/Documents/Welcome.md"))).toEqual({
      target: { type: "file", nodeId: "vfs-content-76cff3ce17d8a853403179f1", previewerId: "markdown" },
      path: "/home/user/Documents/Welcome.md",
    });
  });

  it("keeps about:blank distinct from the Start Page without creating a VFS-backed view", () => {
    const state = createInitialVfsState();
    const blank = createInitialKonquerorNavigationState(createKonquerorBlankLocationTarget(), "about:blank");

    expect(getKonquerorCurrentPath(state, blank)).toEqual({ ok: true, value: "about:blank" });
    expect(getKonquerorView(state, blank)).toEqual({ type: "about-blank", path: "about:blank" });
    expect(getKonquerorCaption(state, getCurrentKonquerorLocationTarget(blank))).toBe("about:blank - Konqueror");
    expect(getKonquerorParentDirectoryNodeId(state, blank)).toBeNull();
  });

  it("resolves trash protocol locations to the canonical backend without duplicating target identity", () => {
    const state = createInitialVfsState();
    const protocol = expectOk(resolveKonquerorAbsoluteLocationTarget(state, "trash:/"));
    const backend = expectOk(
      resolveKonquerorAbsoluteLocationTarget(state, "/home/user/.local/share/Trash/files"),
    );
    const initial = createInitialKonquerorNavigationState(state.specialLocations.documents, "/home/user/Documents");
    const afterProtocol = konquerorNavigationReducer(initial, {
      type: "navigate-success",
      target: protocol.target,
      path: protocol.path,
    });
    const afterBackend = konquerorNavigationReducer(afterProtocol, {
      type: "navigate-success",
      target: backend.target,
      path: backend.path,
    });

    expect(protocol).toEqual({
      target: { type: "directory", nodeId: state.specialLocations.trash },
      path: "trash:/",
    });
    expect(backend).toEqual(protocol);
    expect(
      expectOk(
        getKonquerorCurrentPath(
          state,
          createInitialKonquerorNavigationState(state.specialLocations.trash, "/home/user/.local/share/Trash/files"),
        ),
      ),
    ).toBe("trash:/");
    expect(afterBackend.historyTargets).toHaveLength(2);
    expect(getKonquerorParentDirectoryNodeId(state, afterProtocol)).toBeNull();
  });

  it("resolves nested Trash directories while keeping the protocol root contained", () => {
    const state = createInitialVfsState();
    const created = createVfsDirectory(state, "/home/user/Documents", "Old Folder", {
      now: "2026-08-21T00:00:00.000Z",
    });

    if (!created.ok) {
      throw new Error("fixture creation failed");
    }

    const trashed = moveVfsNodeToTrash(created.state, "/home/user/Documents/Old Folder", {
      now: "2026-08-21T00:01:00.000Z",
    });

    if (!trashed.ok) {
      throw new Error("fixture Trash move failed");
    }

    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(trashed.state, "trash:/Old Folder"))).toEqual({
      target: { type: "directory", nodeId: created.value.id },
      path: "trash:/Old Folder",
    });
    expect(resolveKonquerorAbsoluteLocationTarget(trashed.state, "trash:/../Documents")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH", message: "Unsupported location." },
    });
    expect(resolveKonquerorAbsoluteLocationTarget(trashed.state, "trash://home")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH", message: "Unsupported location." },
    });

    const file = moveVfsNodeToTrash(trashed.state, "/home/user/Documents/Notes.txt", {
      now: "2026-08-21T00:02:00.000Z",
    });

    if (!file.ok) {
      throw new Error("file Trash fixture failed");
    }

    expect(expectOk(resolveKonquerorAbsoluteLocationTarget(file.state, "trash:/Notes.txt"))).toEqual({
      target: { type: "file", nodeId: "vfs-content-e594a065214576326cb903a5", previewerId: "embedded-text" },
      path: "trash:/Notes.txt",
    });
  });

  it("resolves virtual and node captions from the active location target", () => {
    const state = createInitialVfsState();
    expect(getKonquerorCaption(state, createKonquerorAboutLocationTarget("blank"))).toBe("Conquer your Desktop! - Konqueror");
    expect(getKonquerorCaption(state, createKonquerorAboutLocationTarget("canonical"))).toBe("Conquer your Desktop! - Konqueror");
    expect(getKonquerorCaption(state, { type: "sysinfo" })).toBe("My Computer - Konqueror");
    expect(getKonquerorCaption(state, { type: "external-web", canonicalUrl: "https://www.example.com/" })).toBe(
      "www.example.com - Konqueror",
    );
    expect(getKonquerorCaption(state, { type: "directory", nodeId: state.specialLocations.trash })).toBe("Trash - Konqueror");
    expect(getKonquerorCaption(state, { type: "directory", nodeId: state.specialLocations.home })).toBe("user - Konqueror");
    expect(getKonquerorCaption(state, { type: "directory", nodeId: state.rootId })).toBe("Root Folder - Konqueror");
  });

  it("derives nested Trash, file, Unicode, and renamed captions from latest stable nodes", () => {
    const initial = createInitialVfsState();
    const created = createVfsDirectory(initial, "/home/user/Documents", "文档", {
      now: "2026-08-24T00:00:00.000Z",
    });
    if (!created.ok) throw new Error("directory fixture failed");
    const renamed = renameVfsNode(created.state, "/home/user/Documents/文档", "资料", {
      now: "2026-08-24T00:01:00.000Z",
    });
    if (!renamed.ok) throw new Error("directory rename fixture failed");
    const trashed = moveVfsNodeToTrash(renamed.state, "/home/user/Documents/资料", {
      now: "2026-08-24T00:02:00.000Z",
    });
    if (!trashed.ok) throw new Error("directory Trash fixture failed");

    expect(getKonquerorCaption(created.state, { type: "directory", nodeId: created.value.id })).toBe("文档 - Konqueror");
    expect(getKonquerorCaption(renamed.state, { type: "directory", nodeId: created.value.id })).toBe("资料 - Konqueror");
    expect(getKonquerorCaption(trashed.state, { type: "directory", nodeId: created.value.id })).toBe("资料 - Konqueror");
    expect(getKonquerorCaption(initial, { type: "file", nodeId: "vfs-content-76cff3ce17d8a853403179f1", previewerId: "embedded-text" })).toBe(
      "Welcome.md - Konqueror",
    );
    expect(getKonquerorCaption(initial, { type: "file", nodeId: "vfs-content-76cff3ce17d8a853403179f1", previewerId: "khtml" })).toBe(
      "Welcome.md - Konqueror",
    );
  });

  it("treats about:konqueror as a focusless virtual page in the shared view and history model", () => {
    const state = createInitialVfsState();
    const documents = createInitialKonquerorNavigationState(state.specialLocations.documents, "/home/user/Documents");
    const about = konquerorNavigationReducer(documents, {
      type: "navigate-success",
      target: createKonquerorAboutLocationTarget("blank"),
      path: "about:konqueror",
    });

    expect(getKonquerorView(state, about)).toEqual({ type: "about-konqueror", path: "about:konqueror" });
    expect(expectOk(getKonquerorCurrentPath(state, about))).toBe("about:konqueror");
    expect(getKonquerorParentDirectoryNodeId(state, about)).toBeNull();
    expect(findKonquerorHistoryTarget(state, about, "back")).toMatchObject({
      historyIndex: 0,
      target: { path: "/home/user/Documents", node: { id: state.specialLocations.documents } },
    });
  });

  it("resolves sysinfo as a valid mixed-history view with no VFS parent", () => {
    const vfsState = createInitialVfsState();
    const home = createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user");
    const sysinfo = konquerorNavigationReducer(home, {
      type: "navigate-success",
      target: { type: "sysinfo" },
      path: "sysinfo:/",
    });

    expect(getKonquerorView(vfsState, sysinfo)).toEqual({ type: "sysinfo", path: "sysinfo:/" });
    expect(expectOk(getKonquerorCurrentPath(vfsState, sysinfo))).toBe("sysinfo:/");
    expect(getKonquerorParentDirectoryNodeId(vfsState, sysinfo)).toBeNull();
    expect(findKonquerorHistoryTarget(vfsState, sysinfo, "back")).toMatchObject({
      historyIndex: 0,
      target: { path: "/home/user", node: { id: vfsState.specialLocations.home } },
    });
  });

  it("keeps external HTTPS targets in the same per-window history and view model", () => {
    const state = createInitialVfsState();
    const start = createInitialKonquerorNavigationState(createKonquerorAboutLocationTarget("canonical"), "about:konqueror");
    const externalTarget = { type: "external-web" as const, canonicalUrl: "https://www.example.com/" };
    const external = konquerorNavigationReducer(start, {
      type: "navigate-success",
      target: externalTarget,
      path: externalTarget.canonicalUrl,
    });
    const home = konquerorNavigationReducer(external, {
      type: "navigate-success",
      target: { type: "directory", nodeId: state.specialLocations.home },
      path: "/home/user",
    });

    expect(getKonquerorView(state, external)).toEqual({
      type: "external-web",
      canonicalUrl: "https://www.example.com/",
      path: "https://www.example.com/",
    });
    expect(expectOk(getKonquerorCurrentPath(state, external))).toBe("https://www.example.com/");
    expect(getKonquerorParentDirectoryNodeId(state, external)).toBeNull();
    expect(findKonquerorHistoryTarget(state, home, "back")).toMatchObject({
      historyIndex: 1,
      target: { target: externalTarget, path: "https://www.example.com/" },
    });
  });

  it("finds a live history target while skipping missing directory ids", () => {
    const vfsState = createInitialVfsState();
    const navigationState = {
      ...createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user"),
      historyTargets: [
        { type: "directory" as const, nodeId: vfsState.specialLocations.home },
        { type: "directory" as const, nodeId: "missing" },
        { type: "directory" as const, nodeId: vfsState.specialLocations.documents },
      ],
      historyIndex: 2,
    };

    expect(findKonquerorHistoryTarget(vfsState, navigationState, "back")).toMatchObject({
      historyIndex: 0,
      target: { node: { id: vfsState.specialLocations.home } },
    });
    expect(findKonquerorHistoryTarget(vfsState, navigationState, "forward")).toBeNull();
  });

  it("keeps file preview history stable across rename, move, Trash, and Restore", () => {
    const initial = createInitialVfsState();
    const preview = createInitialKonquerorNavigationState(
      { type: "file", nodeId: "vfs-content-e594a065214576326cb903a5" },
      "/home/user/Documents/Notes.txt",
    );
    const renamed = renameVfsNode(initial, "/home/user/Documents/Notes.txt", "Readme", { now: "2026-08-23T00:00:00.000Z" });
    if (!renamed.ok) throw new Error("rename fixture failed");
    const moved = moveVfsNode(renamed.state, "/home/user/Documents/Readme", "/home/user/Downloads", { now: "2026-08-23T00:01:00.000Z" });
    if (!moved.ok) throw new Error("move fixture failed");
    const trashed = moveVfsNodeToTrash(moved.state, "/home/user/Downloads/Readme", { now: "2026-08-23T00:02:00.000Z" });
    if (!trashed.ok) throw new Error("trash fixture failed");
    const restored = restoreVfsNodeFromTrash(trashed.state, "vfs-content-e594a065214576326cb903a5", { now: "2026-08-23T00:03:00.000Z" });
    if (!restored.ok) throw new Error("restore fixture failed");

    expect(expectOk(getKonquerorCurrentPath(renamed.state, preview))).toBe("/home/user/Documents/Readme");
    expect(expectOk(getKonquerorCurrentPath(moved.state, preview))).toBe("/home/user/Downloads/Readme");
    expect(expectOk(getKonquerorCurrentPath(trashed.state, preview))).toBe("trash:/Readme");
    expect(expectOk(getKonquerorCurrentPath(restored.state, preview))).toBe("/home/user/Downloads/Readme");
    expect(getKonquerorCaption(trashed.state, { type: "file", nodeId: "vfs-content-e594a065214576326cb903a5", previewerId: "embedded-text" })).toBe("Readme - Konqueror");
  });

  it("keeps a permanently deleted current preview as an unavailable stable target", () => {
    const initial = createInitialVfsState();
    const preview = createInitialKonquerorNavigationState({ type: "file", nodeId: "vfs-content-e594a065214576326cb903a5" }, "/home/user/Documents/Notes.txt");
    const trashed = moveVfsNodeToTrash(initial, "/home/user/Documents/Notes.txt", { now: "2026-08-23T00:00:00.000Z" });
    if (!trashed.ok) throw new Error("trash fixture failed");
    const deleted = deleteVfsNodePermanently(trashed.state, "vfs-content-e594a065214576326cb903a5", { now: "2026-08-23T00:01:00.000Z" });
    if (!deleted.ok) throw new Error("delete fixture failed");

    const view = getKonquerorView(deleted.state, preview);
    expect(view).toEqual({ type: "file-unavailable", nodeId: "vfs-content-e594a065214576326cb903a5" });
    expect(getKonquerorCaption(deleted.state, { type: "file", nodeId: "vfs-content-e594a065214576326cb903a5" })).toBe("File unavailable - Konqueror");
  });

  it("uses file parents for Up, including the Trash protocol root", () => {
    const state = createInitialVfsState();
    const regularPreview = createInitialKonquerorNavigationState(
      { type: "file", nodeId: "vfs-content-76cff3ce17d8a853403179f1" },
      "/home/user/Documents/Welcome.md",
    );
    const trashed = moveVfsNodeToTrash(state, "/home/user/Documents/Notes.txt", { now: "2026-08-23T00:00:00.000Z" });
    if (!trashed.ok) throw new Error("trash fixture failed");
    const trashPreview = createInitialKonquerorNavigationState({ type: "file", nodeId: "vfs-content-e594a065214576326cb903a5" }, "trash:/Notes.txt");

    expect(getKonquerorParentDirectoryNodeId(state, regularPreview)).toBe(state.specialLocations.documents);
    expect(getKonquerorParentDirectoryNodeId(trashed.state, trashPreview)).toBe(
      trashed.state.specialLocations.trash,
    );
  });

  it("keeps directory history identity stable while paths change after rename and move", () => {
    const initial = createInitialVfsState();
    const created = createVfsDirectory(initial, "/home/user/Documents", "Projects", {
      now: "2026-08-11T00:00:00.000Z",
    });

    if (!created.ok) {
      throw new Error("fixture creation failed");
    }

    const renamed = renameVfsNode(created.state, "/home/user/Documents/Projects", "Renamed", {
      now: "2026-08-11T00:01:00.000Z",
    });

    if (!renamed.ok) {
      throw new Error("fixture rename failed");
    }

    const moved = moveVfsNode(renamed.state, "/home/user/Documents/Renamed", "/home/user/Downloads", {
      now: "2026-08-11T00:02:00.000Z",
    });

    if (!moved.ok) {
      throw new Error("fixture move failed");
    }

    const navigationState = createInitialKonquerorNavigationState(created.value.id, "/home/user/Documents/Projects");

    expect(expectOk(resolveKonquerorAbsoluteDirectoryLocation(moved.state, "/home/user/Downloads/Renamed")).node.id).toBe(
      created.value.id,
    );
    expect(expectOk(resolveKonquerorNodeId(moved.state, navigationState.historyTargets[0]?.type === "directory" ? navigationState.historyTargets[0].nodeId : "")).path).toBe(
      "/home/user/Downloads/Renamed",
    );
  });

  it("does not need manual reload state copies for VFS revision changes", () => {
    const vfsState = createInitialVfsState();
    const created = createVfsDirectory(vfsState, "/home/user", "Projects", {
      now: "2026-08-03T00:00:00.000Z",
    });
    const navigationState = createInitialKonquerorNavigationState(vfsState.specialLocations.home, "/home/user");

    if (!created.ok) {
      throw new Error("fixture mutation failed");
    }

    const view = getKonquerorView(created.state, navigationState);

    expect(view.type === "directory" ? view.children.map((node) => node.name) : []).toContain("Projects");
    expect(created.state.revision).toBe(vfsState.revision + 1);
  });

  it("formats navigation errors for display without modifying VFS errors", () => {
    expect(formatKonquerorNavigationError({ code: "INVALID_PATH", message: "raw" })).toBe(
      "The location is not a valid VFS path.",
    );
    expect(formatKonquerorNavigationError({ code: "NOT_DIRECTORY", message: "raw" })).toBe(
      "A path component is not a directory.",
    );
    expect(formatKonquerorNavigationError({ code: "INVALID_PATH", message: "Enter an absolute VFS path." })).toBe(
      "Enter an absolute VFS path.",
    );
    expect(formatKonquerorNavigationError({ code: "NOT_DIRECTORY", message: "Location is not a directory." })).toBe(
      "Location is not a directory.",
    );
    expect(formatKonquerorNavigationError({ code: "INVALID_PATH", message: "Unsupported location." })).toBe(
      "Unsupported location.",
    );
  });
});
