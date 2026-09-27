import { isProtectedVfsNode, isVfsNodeInsideTrash } from "../../vfs/tree";
import type { VfsNode, VfsNodeId, VfsState } from "../../vfs/types";
import type { KonquerorClipboardState } from "./clipboardTypes";
import type { KonquerorView } from "./navigationTypes";
import { getSingleKonquerorSelectedNodeId, normalizeKonquerorSelection, type KonquerorSelectedNodeIds } from "./selectionModel";

export interface KonquerorClipboardAvailabilityInput {
  readonly state: VfsState;
  readonly view: KonquerorView;
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly visibleNodeIds: readonly VfsNodeId[];
  readonly clipboardState: KonquerorClipboardState;
  readonly isEditing: boolean;
  readonly isCommandDialogOpen: boolean;
  readonly isConfirmationOpen: boolean;
  readonly isPropertiesOpen?: boolean;
  /** A preview may explicitly expose its exact current VFS file as the operation target. */
  readonly currentFileNodeId?: VfsNodeId;
}

export interface KonquerorClipboardAvailability {
  readonly canCopy: boolean;
  readonly canCut: boolean;
  readonly canPaste: boolean;
  readonly canMoveToTrash: boolean;
  readonly canOpenTrash: boolean;
  readonly isTrashView: boolean;
  readonly copyTitle: string;
  readonly cutTitle: string;
  readonly pasteTitle: string;
  readonly moveToTrashTitle: string;
  readonly openTrashTitle: string;
  readonly selectedNode: VfsNode | null;
  readonly selectedNodes: readonly VfsNode[];
}

const busyTitle = "Finish the current operation first";
const editTitle = "Save or discard changes before using file operations";

function findSelectedNode(
  state: VfsState,
  view: KonquerorView,
  selectedNodeIds: KonquerorSelectedNodeIds,
  currentFileNodeId: VfsNodeId | undefined,
): VfsNode | null {
  const selectedNodeId = getSingleKonquerorSelectedNodeId(selectedNodeIds);
  if (
    selectedNodeId === null ||
    (view.type !== "directory" && (view.type !== "file" || view.node.id !== selectedNodeId || currentFileNodeId !== view.node.id))
  ) {
    return null;
  }

  return state.nodesById[selectedNodeId] ?? null;
}

function findSelectedNodes(
  state: VfsState,
  view: KonquerorView,
  selectedNodeIds: KonquerorSelectedNodeIds,
  visibleNodeIds: readonly VfsNodeId[],
  currentFileNodeId: VfsNodeId | undefined,
): readonly VfsNode[] {
  if (view.type === "file") {
    return currentFileNodeId === view.node.id && selectedNodeIds.length === 1 && selectedNodeIds[0] === view.node.id
      ? [view.node]
      : [];
  }

  if (view.type !== "directory") {
    return [];
  }

  const selected = new Set(selectedNodeIds);
  return visibleNodeIds
    .filter((nodeId) => selected.has(nodeId))
    .map((nodeId) => state.nodesById[nodeId])
    .filter((node): node is VfsNode => node !== undefined);
}

export function getKonquerorClipboardAvailability({
  clipboardState,
  isCommandDialogOpen,
  isConfirmationOpen,
  isPropertiesOpen = false,
  isEditing,
  currentFileNodeId,
  selectedNodeIds,
  state,
  view,
  visibleNodeIds,
}: KonquerorClipboardAvailabilityInput): KonquerorClipboardAvailability {
  const isBusy = isCommandDialogOpen || isConfirmationOpen || isPropertiesOpen;
  const isTrashView = (view.type === "directory" || view.type === "file") && isVfsNodeInsideTrash(state, view.node.id);
  const selectedNode = findSelectedNode(state, view, selectedNodeIds, currentFileNodeId);
  const selectedNodes = findSelectedNodes(state, view, selectedNodeIds, visibleNodeIds, currentFileNodeId);
  const hasNormalSelection =
    selectedNodes.length > 0 &&
    selectedNodes.length === normalizeKonquerorSelection(selectedNodeIds).length &&
    selectedNodes.every((node) => !isVfsNodeInsideTrash(state, node.id));
  const isBlocked = isEditing || isBusy || isTrashView;
  const canCopy = (view.type === "directory" || (view.type === "file" && currentFileNodeId === view.node.id)) && hasNormalSelection && !isBlocked;
  const canCut =
    canCopy && selectedNodes.every((node) => node.id !== state.rootId && !isProtectedVfsNode(state, node.id));
  const canPaste =
    clipboardState.kind === "items" && clipboardState.entries.length > 0 && view.type === "directory" && !isVfsNodeInsideTrash(state, view.node.id) && !isEditing && !isBusy;
  const canMoveToTrash =
    view.type === "directory" &&
    hasNormalSelection &&
    selectedNodes.every((node) => !isProtectedVfsNode(state, node.id)) &&
    !isBlocked;
  const canOpenTrash = !isEditing && !isBusy;

  const disabledSelectionTitle = selectedNodeIds.length > 1
    ? "Select exactly one file or folder"
    : "Select a file or folder first";

  return {
    canCopy,
    canCut,
    canPaste,
    canMoveToTrash,
    canOpenTrash,
    isTrashView,
    selectedNode,
    selectedNodes,
    copyTitle: canCopy
      ? "Copy"
      : isEditing
      ? editTitle
      : isBusy
      ? busyTitle
      : isTrashView
      ? "Items in the Trash are read-only"
      : disabledSelectionTitle,
    cutTitle: canCut
      ? "Cut"
      : isEditing
      ? editTitle
      : isBusy
      ? busyTitle
      : isTrashView
      ? "Items in the Trash are read-only"
      : selectedNodes.some((node) => isProtectedVfsNode(state, node.id))
      ? "System folders cannot be moved"
      : disabledSelectionTitle,
    pasteTitle: canPaste
      ? "Paste"
      : isEditing
      ? editTitle
      : isBusy
      ? busyTitle
      : isTrashView
      ? "Items cannot be pasted into the Trash"
      : clipboardState.kind === "empty"
      ? "Copy or cut an item before pasting"
      : "Open a folder before pasting",
    moveToTrashTitle: canMoveToTrash
      ? "Move to Trash"
      : isEditing
      ? editTitle
      : isBusy
      ? busyTitle
      : isTrashView
      ? "Items in the Trash are read-only"
      : selectedNodes.some((node) => isProtectedVfsNode(state, node.id))
      ? "System folders cannot be moved to the Trash"
      : disabledSelectionTitle,
    openTrashTitle: canOpenTrash ? "Open Trash" : isEditing ? editTitle : busyTitle,
  };
}
