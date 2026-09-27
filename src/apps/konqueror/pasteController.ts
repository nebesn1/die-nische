import type { VfsError } from "../../vfs/errors";
import { getVfsNodeById, getVfsPathForNode } from "../../vfs/queries";
import type { VfsResult } from "../../vfs/result";
import { isVfsNodeInsideTrash } from "../../vfs/tree";
import type { VfsDirectoryNode, VfsNode, VfsNodeId, VfsState } from "../../vfs/types";
import type { VfsContextValue } from "../../vfs/VfsContext";
import type { KonquerorClipboardState } from "./clipboardTypes";
import type { KonquerorCommandEnvironment } from "./commandTypes";

export type KonquerorPasteOperations = Pick<VfsContextValue, "copyNodes" | "moveNodes">;

export type KonquerorPasteResult =
  | {
      readonly ok: true;
      readonly selectedNodeIds: readonly VfsNodeId[];
      readonly shouldClearClipboard: boolean;
      readonly statusMessage: string;
    }
  | {
      readonly ok: false;
      readonly error: VfsError;
      readonly shouldClearClipboard: boolean;
    };

const fail = (error: VfsError): KonquerorPasteResult => ({ ok: false, error, shouldClearClipboard: false });
const getNodePath = (state: VfsState, nodeId: VfsNodeId): VfsResult<string> => getVfsPathForNode(state, nodeId);

const getDestinationDirectory = (state: VfsState, destinationDirectoryNodeId: VfsNodeId): VfsResult<VfsDirectoryNode> => {
  const destination = getVfsNodeById(state, destinationDirectoryNodeId);
  if (!destination.ok) return destination;
  if (destination.value.kind !== "directory") {
    return { ok: false, error: { code: "NOT_DIRECTORY", message: "Items can only be pasted into a folder.", nodeId: destination.value.id } };
  }
  return { ok: true, value: destination.value };
};

const describeNodes = (nodes: readonly VfsNode[]): string =>
  nodes.length === 1 ? nodes[0]?.name ?? "item" : `${nodes.length} items`;

export function pasteKonquerorClipboardItems(
  state: VfsState,
  clipboardState: KonquerorClipboardState,
  destinationDirectoryNodeId: VfsNodeId,
  operations: KonquerorPasteOperations,
  environment: KonquerorCommandEnvironment,
): KonquerorPasteResult {
  if (clipboardState.kind === "empty" || clipboardState.entries.length === 0) {
    return fail({ code: "NOT_FOUND", message: "Clipboard is empty." });
  }

  const destination = getDestinationDirectory(state, destinationDirectoryNodeId);
  if (!destination.ok) return fail(destination.error);
  if (isVfsNodeInsideTrash(state, destination.value.id)) {
    return fail({ code: "INVALID_DESTINATION", message: "Items cannot be pasted into the Trash.", nodeId: destination.value.id });
  }

  const sourceIds = [...new Set(clipboardState.entries.map((entry) => entry.nodeId))];
  if (sourceIds.length !== clipboardState.entries.length) {
    return fail({ code: "NOT_FOUND", message: "Clipboard contains duplicate items." });
  }

  const sources: VfsNode[] = [];
  const sourcePaths: string[] = [];
  for (const entry of clipboardState.entries) {
    const source = getVfsNodeById(state, entry.nodeId);
    if (!source.ok || source.value.parentId !== entry.sourceParentId) {
      return fail(source.ok
        ? { code: "NOT_FOUND", message: "Clipboard item is no longer in its original folder.", nodeId: entry.nodeId }
        : source.error);
    }
    const path = getNodePath(state, entry.nodeId);
    if (!path.ok) return fail(path.error);
    sources.push(source.value);
    sourcePaths.push(path.value);
  }

  const destinationPath = getNodePath(state, destination.value.id);
  if (!destinationPath.ok) return fail(destinationPath.error);

  const result = clipboardState.mode === "copy"
    ? operations.copyNodes(sourcePaths, destinationPath.value, { now: environment.now() })
    : operations.moveNodes(sourcePaths, destinationPath.value, { now: environment.now() });
  if (!result.ok) return fail(result.error);

  const verb = clipboardState.mode === "copy" ? "Copied" : "Moved";
  return {
    ok: true,
    selectedNodeIds: result.value.map((node) => node.id),
    shouldClearClipboard: clipboardState.mode === "cut",
    statusMessage: `${verb} ${describeNodes(sources)} to ${destination.value.name === "" ? "/" : destination.value.name}`,
  };
}
