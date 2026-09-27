import { getVfsPathForNode } from "../../vfs/queries";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import { formatVirtualVfsFileUri } from "../../desktop/klipperUri";

export function getKonquerorClipboardMirrorUri(state: VfsState, nodeId: VfsNodeId): string | null {
  const path = getVfsPathForNode(state, nodeId);

  return path.ok ? formatVirtualVfsFileUri(path.value) : null;
}
