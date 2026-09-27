import type { VfsNodeId, VfsState } from "../../vfs/types";
import { ok, type VfsResult } from "../../vfs/result";
import {
  createKonquerorOpenDirectoryIntent,
  createKonquerorOpenFileIntent,
  type KonquerorOpenDirectoryIntent,
  type KonquerorOpenFileIntent,
} from "./launchIntent";
import { resolveKonquerorNodeId } from "./navigationController";

export interface KonquerorNodeOpenPlan {
  readonly appId: "konqueror";
  readonly intent: KonquerorOpenDirectoryIntent | KonquerorOpenFileIntent;
}

/** Resolves a stable VFS node against the latest state before requesting a normal Konqueror open. */
export function planKonquerorNodeOpen(state: VfsState, nodeId: VfsNodeId): VfsResult<KonquerorNodeOpenPlan> {
  const target = resolveKonquerorNodeId(state, nodeId);

  if (!target.ok) {
    return target;
  }

  return ok({
    appId: "konqueror",
    intent: target.value.node.kind === "directory"
      ? createKonquerorOpenDirectoryIntent(target.value.node.id)
      : createKonquerorOpenFileIntent(target.value.node.id),
  });
}
