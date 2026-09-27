import type { VfsNode, VfsNodeId, VfsState } from "../../vfs/types";
import { getKonquerorCreateChildAvailability } from "./createChildCapability";
import type { KonquerorView } from "./navigationTypes";
import { getSingleKonquerorSelectedNodeId, type KonquerorSelectedNodeIds } from "./selectionModel";

export interface KonquerorCommandAvailability {
  readonly canCreateNewFolder: boolean;
  readonly canCreateNewTextFile: boolean;
  readonly canRename: boolean;
  readonly createDisabledTitle: string;
  readonly renameDisabledTitle: string;
  readonly renameTargetNodeId: VfsNodeId | null;
  readonly renameTargetName: string | null;
}

const findSelectedNode = (
  state: VfsState,
  view: KonquerorView,
  selectedNodeIds: KonquerorSelectedNodeIds,
): VfsNode | null => {
  const selectedNodeId = getSingleKonquerorSelectedNodeId(selectedNodeIds);
  if (view.type !== "directory" || selectedNodeId === null) {
    return null;
  }

  return state.nodesById[selectedNodeId] ?? null;
};

export function getKonquerorCommandAvailability(
  state: VfsState,
  view: KonquerorView,
  selectedNodeIds: KonquerorSelectedNodeIds,
): KonquerorCommandAvailability {
  const createChildAvailability = view.type === "directory"
    ? getKonquerorCreateChildAvailability(state, view.node.id)
    : null;
  const canCreate = createChildAvailability?.canCreateChild ?? false;
  const selectedNode = findSelectedNode(state, view, selectedNodeIds);
  const renameTarget = selectedNode;
  const canRename = Boolean(renameTarget && renameTarget.id !== state.rootId);

  return {
    canCreateNewFolder: canCreate,
    canCreateNewTextFile: canCreate,
    canRename,
    createDisabledTitle: canCreate ? "" : createChildAvailability?.title ?? "Open a folder before creating a new item",
    renameDisabledTitle: canRename
      ? ""
      : selectedNodeIds.length > 1
      ? "Select exactly one file or folder before renaming"
      : "Select a file or folder before renaming",
    renameTargetNodeId: renameTarget?.id ?? null,
    renameTargetName: renameTarget?.name ?? null,
  };
}
