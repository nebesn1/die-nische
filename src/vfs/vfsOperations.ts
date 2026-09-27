import {
  appendVfsTextFile,
  copyVfsNode,
  copyVfsNodes,
  createVfsDirectory,
  createVfsLinks,
  createVfsTextFile,
  deleteVfsNodePermanently,
  deleteVfsNodesPermanently,
  emptyVfsTrash,
  moveVfsNode,
  moveVfsNodes,
  moveVfsNodeToTrash,
  moveVfsNodesToTrash,
  renameVfsNode,
  restoreVfsNodeFromTrash,
  restoreVfsNodesFromTrash,
  writeVfsTextFile,
} from "./mutations";
import {
  createVfsFileOperationUndoEntry,
  undoVfsFileOperation,
  type VfsFileOperationUndoEntry,
  type VfsFileOperationUndoKind,
} from "./fileOperationUndo";
import { getVfsTrashEntry, listVfsDirectory, listVfsTrashEntries, readVfsTextFile, resolveVfsPath } from "./queries";
import { fail, ok, type VfsMutationResult, type VfsResult } from "./result";
import type {
  CopyVfsNodeOptions,
  MoveVfsNodeOptions,
  VfsDeleteResult,
  VfsDirectoryNode,
  VfsLinkNode,
  VfsMutationOptions,
  VfsNode,
  VfsNodeId,
  VfsState,
  VfsTextFileNode,
  VfsTrashEntry,
} from "./types";

export interface VfsOperations {
  createFileOperationUndoEntry(
    kind: VfsFileOperationUndoKind,
    beforeState: VfsState,
    nodeIds: readonly VfsNodeId[],
  ): VfsResult<VfsFileOperationUndoEntry | null>;
  undoFileOperation(entry: VfsFileOperationUndoEntry, options: VfsMutationOptions): VfsResult<void>;
  resolvePath(path: string, cwd?: string): VfsResult<VfsNode>;
  listDirectory(path: string, cwd?: string): VfsResult<readonly VfsNode[]>;
  readTextFile(path: string, cwd?: string): VfsResult<VfsTextFileNode>;
  getTrashEntry(nodeId: VfsNodeId): VfsResult<VfsTrashEntry>;
  listTrashEntries(): VfsResult<readonly { readonly entry: VfsTrashEntry; readonly node: VfsNode }[]>;
  createDirectory(parentPath: string, name: string, options: { readonly now: string }): VfsResult<VfsDirectoryNode>;
  createLinks(destinationParentNodeId: VfsNodeId, sourceNodeIds: readonly VfsNodeId[], options: VfsMutationOptions): VfsResult<readonly VfsLinkNode[]>;
  createTextFile(
    parentPath: string,
    name: string,
    content: string,
    options: { readonly now: string; readonly mimeType?: string },
  ): VfsResult<VfsTextFileNode>;
  writeTextFile(path: string, content: string, options: { readonly now: string }): VfsResult<VfsTextFileNode>;
  appendTextFile(path: string, text: string, options: { readonly now: string }): VfsResult<VfsTextFileNode>;
  renameNode(path: string, newName: string, options: { readonly now: string }): VfsResult<VfsNode>;
  moveNode(sourcePath: string, destinationDirectoryPath: string, options: MoveVfsNodeOptions): VfsResult<VfsNode>;
  copyNode(sourcePath: string, destinationDirectoryPath: string, options: CopyVfsNodeOptions): VfsResult<VfsNode>;
  copyNodes(sourcePaths: readonly string[], destinationDirectoryPath: string, options: CopyVfsNodeOptions): VfsResult<readonly VfsNode[]>;
  moveNodeToTrash(sourcePath: string, options: VfsMutationOptions): VfsResult<VfsNode>;
  moveNodes(sourcePaths: readonly string[], destinationDirectoryPath: string, options: MoveVfsNodeOptions): VfsResult<readonly VfsNode[]>;
  moveNodesToTrash(sourcePaths: readonly string[], options: VfsMutationOptions): VfsResult<readonly VfsNode[]>;
  restoreNodeFromTrash(nodeId: VfsNodeId, options: VfsMutationOptions): VfsResult<VfsNode>;
  restoreNodesFromTrash(nodeIds: readonly VfsNodeId[], options: VfsMutationOptions): VfsResult<readonly VfsNode[]>;
  deleteNodePermanently(nodeId: VfsNodeId, options: VfsMutationOptions): VfsResult<VfsDeleteResult>;
  deleteNodesPermanently(nodeIds: readonly VfsNodeId[], options: VfsMutationOptions): VfsResult<VfsDeleteResult>;
  emptyTrash(options: VfsMutationOptions): VfsResult<VfsDeleteResult>;
}

export function createVfsOperations(
  readState: () => VfsState,
  commitState: (state: VfsState) => void,
): VfsOperations {
  const applyMutation = <T,>(mutation: VfsMutationResult<T>): VfsResult<T> => {
    if (!mutation.ok) {
      return fail(mutation.error);
    }

    commitState(mutation.state);

    return ok(mutation.value);
  };

  return {
    createFileOperationUndoEntry: (kind, beforeState, nodeIds) =>
      createVfsFileOperationUndoEntry(kind, beforeState, readState(), nodeIds),
    undoFileOperation: (entry, options) => applyMutation(undoVfsFileOperation(readState(), entry, options)),
    resolvePath: (path, cwd) => resolveVfsPath(readState(), path, cwd),
    listDirectory: (path, cwd) => listVfsDirectory(readState(), path, cwd),
    readTextFile: (path, cwd) => readVfsTextFile(readState(), path, cwd),
    getTrashEntry: (nodeId) => getVfsTrashEntry(readState(), nodeId),
    listTrashEntries: () => listVfsTrashEntries(readState()),
    createDirectory: (parentPath, name, options) =>
      applyMutation(createVfsDirectory(readState(), parentPath, name, options)),
    createLinks: (destinationParentNodeId, sourceNodeIds, options) =>
      applyMutation(createVfsLinks(readState(), destinationParentNodeId, sourceNodeIds, options)),
    createTextFile: (parentPath, name, content, options) =>
      applyMutation(createVfsTextFile(readState(), parentPath, name, content, options)),
    writeTextFile: (path, content, options) => applyMutation(writeVfsTextFile(readState(), path, content, options)),
    appendTextFile: (path, text, options) => applyMutation(appendVfsTextFile(readState(), path, text, options)),
    renameNode: (path, newName, options) => applyMutation(renameVfsNode(readState(), path, newName, options)),
    moveNode: (sourcePath, destinationDirectoryPath, options) =>
      applyMutation(moveVfsNode(readState(), sourcePath, destinationDirectoryPath, options)),
    copyNode: (sourcePath, destinationDirectoryPath, options) =>
      applyMutation(copyVfsNode(readState(), sourcePath, destinationDirectoryPath, options)),
    copyNodes: (sourcePaths, destinationDirectoryPath, options) =>
      applyMutation(copyVfsNodes(readState(), sourcePaths, destinationDirectoryPath, options)),
    moveNodeToTrash: (sourcePath, options) => applyMutation(moveVfsNodeToTrash(readState(), sourcePath, options)),
    moveNodes: (sourcePaths, destinationDirectoryPath, options) =>
      applyMutation(moveVfsNodes(readState(), sourcePaths, destinationDirectoryPath, options)),
    moveNodesToTrash: (sourcePaths, options) => applyMutation(moveVfsNodesToTrash(readState(), sourcePaths, options)),
    restoreNodeFromTrash: (nodeId, options) => applyMutation(restoreVfsNodeFromTrash(readState(), nodeId, options)),
    restoreNodesFromTrash: (nodeIds, options) => applyMutation(restoreVfsNodesFromTrash(readState(), nodeIds, options)),
    deleteNodePermanently: (nodeId, options) => applyMutation(deleteVfsNodePermanently(readState(), nodeId, options)),
    deleteNodesPermanently: (nodeIds, options) => applyMutation(deleteVfsNodesPermanently(readState(), nodeIds, options)),
    emptyTrash: (options) => applyMutation(emptyVfsTrash(readState(), options)),
  };
}
