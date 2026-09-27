import { createContext } from "react";
import type { VfsResult } from "./result";
import type { VfsFileOperationUndoEntry, VfsFileOperationUndoKind } from "./fileOperationUndo";
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

export interface VfsContextValue {
  readonly state: VfsState;
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

export const VfsContext = createContext<VfsContextValue | null>(null);
