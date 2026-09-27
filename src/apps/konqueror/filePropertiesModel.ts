import { getVfsNodeById, getVfsPathForNode } from "../../vfs/queries";
import { getVfsLinkTargetStatus } from "../../vfs/links";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import { formatKonquerorNodeSize, formatKonquerorTimestamp, getKonquerorNodeTypeLabel } from "./formatters";
import { getKonquerorNodeIconId, type KonquerorNodeIconId } from "./nodePresentation";

export type KonquerorFileProperties = {
  readonly nodeId: VfsNodeId;
  readonly name: string;
  readonly typeLabel: string;
  readonly location: string;
  readonly fullPath: string;
  readonly sizeLabel: string;
  readonly createdLabel: string;
  readonly modifiedLabel: string;
  readonly iconId: KonquerorNodeIconId;
  readonly target: string | null;
};

export type KonquerorFilePropertiesResult =
  | { readonly type: "available"; readonly properties: KonquerorFileProperties }
  | { readonly type: "unavailable" };

export function deriveKonquerorFileProperties(
  state: VfsState,
  nodeId: VfsNodeId,
): KonquerorFilePropertiesResult {
  const nodeResult = getVfsNodeById(state, nodeId);
  const fullPathResult = getVfsPathForNode(state, nodeId);

  if (!nodeResult.ok || !fullPathResult.ok) {
    return { type: "unavailable" };
  }

  const locationResult = nodeResult.value.parentId
    ? getVfsPathForNode(state, nodeResult.value.parentId)
    : null;

  const linkTarget = nodeResult.value.kind === "link" ? getVfsLinkTargetStatus(state, nodeResult.value.id) : null;

  return {
    type: "available",
    properties: {
      nodeId: nodeResult.value.id,
      name: nodeResult.value.name,
      typeLabel: getKonquerorNodeTypeLabel(nodeResult.value, state),
      location: locationResult?.ok ? locationResult.value : "-",
      fullPath: fullPathResult.value,
      sizeLabel: formatKonquerorNodeSize(nodeResult.value),
      createdLabel: formatKonquerorTimestamp(nodeResult.value.createdAt),
      modifiedLabel: formatKonquerorTimestamp(nodeResult.value.modifiedAt),
      iconId: getKonquerorNodeIconId(nodeResult.value, state),
      target: linkTarget?.type === "resolved" ? linkTarget.path : linkTarget ? "Missing or unavailable" : null,
    },
  };
}
