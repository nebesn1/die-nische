import { describe, expect, it, vi } from "vitest";
import type { VfsContextValue } from "../../vfs/VfsContext";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsError } from "../../vfs/errors";
import { fail } from "../../vfs/result";
import { createKonsoleMutationPort } from "./createKonsoleMutationPort";

describe("createKonsoleMutationPort", () => {
  it("adapts VfsProvider commands without exposing state replacement", () => {
    const vfs = {
      state: createInitialVfsState(),
      createFileOperationUndoEntry: vi.fn(),
      undoFileOperation: vi.fn(),
      resolvePath: vi.fn(),
      listDirectory: vi.fn(),
      readTextFile: vi.fn(),
      getTrashEntry: vi.fn(),
      listTrashEntries: vi.fn(),
      createLinks: vi.fn(),
      createDirectory: vi.fn(() => fail(createVfsError("ALREADY_EXISTS", "exists"))),
      createTextFile: vi.fn(() => fail(createVfsError("ALREADY_EXISTS", "exists"))),
      writeTextFile: vi.fn(),
      appendTextFile: vi.fn(),
      renameNode: vi.fn(),
      moveNode: vi.fn(() => fail(createVfsError("ALREADY_EXISTS", "exists"))),
      copyNode: vi.fn(() => fail(createVfsError("ALREADY_EXISTS", "exists"))),
      copyNodes: vi.fn(),
      moveNodeToTrash: vi.fn(() => fail(createVfsError("ALREADY_IN_TRASH", "in trash"))),
      moveNodes: vi.fn(),
      moveNodesToTrash: vi.fn(),
      restoreNodeFromTrash: vi.fn(),
      restoreNodesFromTrash: vi.fn(),
      deleteNodePermanently: vi.fn(),
      deleteNodesPermanently: vi.fn(),
      emptyTrash: vi.fn(),
    } satisfies VfsContextValue;

    const port = createKonsoleMutationPort(vfs);

    port.createDirectory("/home/user", "A", { now: "2003-04-06T12:30:00.000Z" });
    port.createTextFile("/home/user", "A.txt", "", {
      now: "2003-04-06T12:30:00.000Z",
      mimeType: "text/plain",
    });
    port.appendTextFile("/home/user/A.txt", "line\n", { now: "2003-04-06T12:30:00.000Z" });
    port.copyNode("/home/user/A.txt", "/home/user/Documents", { now: "2003-04-06T12:30:00.000Z" });
    port.moveNode("/home/user/A.txt", "/home/user/Documents", { now: "2003-04-06T12:30:00.000Z" });
    port.moveNodeToTrash("/home/user/A.txt", { now: "2003-04-06T12:30:00.000Z" });
    port.restoreNodeFromTrash("vfs-node-0010", { now: "2003-04-06T12:30:00.000Z" });
    port.deleteNodePermanently("vfs-node-0010", { now: "2003-04-06T12:30:00.000Z" });
    port.emptyTrash({ now: "2003-04-06T12:30:00.000Z" });

    expect(vfs.createDirectory).toHaveBeenCalledWith("/home/user", "A", {
      now: "2003-04-06T12:30:00.000Z",
    });
    expect(vfs.createTextFile).toHaveBeenCalledWith("/home/user", "A.txt", "", {
      now: "2003-04-06T12:30:00.000Z",
      mimeType: "text/plain",
    });
    expect(vfs.appendTextFile).toHaveBeenCalledWith("/home/user/A.txt", "line\n", {
      now: "2003-04-06T12:30:00.000Z",
    });
    expect(vfs.copyNode).toHaveBeenCalled();
    expect(vfs.moveNode).toHaveBeenCalled();
    expect(vfs.moveNodeToTrash).toHaveBeenCalled();
    expect(vfs.restoreNodeFromTrash).toHaveBeenCalledWith("vfs-node-0010", {
      now: "2003-04-06T12:30:00.000Z",
    });
    expect(vfs.deleteNodePermanently).toHaveBeenCalledWith("vfs-node-0010", {
      now: "2003-04-06T12:30:00.000Z",
    });
    expect(vfs.emptyTrash).toHaveBeenCalledWith({
      now: "2003-04-06T12:30:00.000Z",
    });
    expect("setState" in port).toBe(false);
  });
});
