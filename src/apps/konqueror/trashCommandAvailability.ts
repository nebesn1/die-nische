import type { VfsNodeId, VfsState } from "../../vfs/types";
import type { KonquerorView } from "./navigationTypes";
import { getSingleKonquerorSelectedNodeId, type KonquerorSelectedNodeIds } from "./selectionModel";

export interface KonquerorTrashCommandAvailabilityInput {
  readonly state: VfsState;
  readonly view: KonquerorView;
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly visibleNodeIds: readonly VfsNodeId[];
  readonly isBlocking: boolean;
}

export interface KonquerorTrashCommandAvailability {
  readonly canRestore: boolean;
  readonly canDeletePermanently: boolean;
  readonly canEmptyTrash: boolean;
  readonly restoreTitle: string;
  readonly deletePermanentlyTitle: string;
  readonly emptyTrashTitle: string;
  readonly selectedTrashEntryNodeId: VfsNodeId | null;
  readonly selectedTrashEntryName: string | null;
  readonly selectedTrashEntryNodeIds: readonly VfsNodeId[];
}

const busyTitle = "Finish the current operation first";

export function getKonquerorTrashCommandAvailability({
  isBlocking,
  selectedNodeIds,
  state,
  view,
  visibleNodeIds,
}: KonquerorTrashCommandAvailabilityInput): KonquerorTrashCommandAvailability {
  const trash = state.nodesById[state.specialLocations.trash];
  const isTrashRoot = view.type === "directory" && view.node.id === state.specialLocations.trash;
  const selectedNodeId = getSingleKonquerorSelectedNodeId(selectedNodeIds);
  const selectedNode =
    isTrashRoot && selectedNodeId && trash?.kind === "directory" && trash.childIds.includes(selectedNodeId)
      ? state.nodesById[selectedNodeId] ?? null
      : null;
  const selected = new Set(selectedNodeIds);
  const selectedTrashEntryNodeIds = isTrashRoot && trash?.kind === "directory"
    ? visibleNodeIds.filter((nodeId) => selected.has(nodeId) && trash.childIds.includes(nodeId) && Boolean(state.trashEntriesByNodeId[nodeId]))
    : [];
  const hasTrashEntries = selectedNodeIds.length > 0 && selectedTrashEntryNodeIds.length === selectedNodeIds.length;
  const canRestore = isTrashRoot && hasTrashEntries && !isBlocking;
  const canDeletePermanently = canRestore;
  const canEmptyTrash = isTrashRoot && trash?.kind === "directory" && trash.childIds.length > 0 && !isBlocking;
  const selectionTitle = isTrashRoot
    ? selectedNodeIds.length > 1
      ? "Select exactly one item in the Trash"
      : "Select an item in the Trash first"
    : "Open the Trash root first";

  return {
    canRestore,
    canDeletePermanently,
    canEmptyTrash,
    selectedTrashEntryNodeId: selectedNode?.id ?? null,
    selectedTrashEntryName: selectedNode?.name ?? null,
    selectedTrashEntryNodeIds,
    restoreTitle: canRestore ? "Restore" : isBlocking ? busyTitle : selectionTitle,
    deletePermanentlyTitle: canDeletePermanently
      ? "Delete Permanently"
      : isBlocking
      ? busyTitle
      : selectionTitle,
    emptyTrashTitle: canEmptyTrash
      ? "Empty Trash"
      : isBlocking
      ? busyTitle
      : isTrashRoot
      ? "The Trash is empty"
      : "Open the Trash root first",
  };
}
