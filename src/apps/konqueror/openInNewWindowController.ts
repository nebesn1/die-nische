import { fail, ok, type VfsResult } from "../../vfs/result";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import { createKonquerorOpenDirectoryIntent, createKonquerorOpenFileIntent } from "./launchIntent";
import { resolveKonquerorNodeId } from "./navigationController";

export type KonquerorOpenInNewWindowIntent =
  | ReturnType<typeof createKonquerorOpenDirectoryIntent>
  | ReturnType<typeof createKonquerorOpenFileIntent>;

/** Resolves every requested Resource target before any explicit instance is launched. */
export function planKonquerorOpenInNewWindow(
  state: VfsState,
  targetNodeIds: readonly VfsNodeId[],
): VfsResult<readonly KonquerorOpenInNewWindowIntent[]> {
  if (targetNodeIds.length === 0) {
    return fail({ code: "NOT_FOUND", message: "Select a file or folder first." });
  }

  const intents: KonquerorOpenInNewWindowIntent[] = [];

  for (const nodeId of targetNodeIds) {
    const target = resolveKonquerorNodeId(state, nodeId);

    if (!target.ok) {
      return target;
    }

    intents.push(
      target.value.node.kind === "directory"
        ? createKonquerorOpenDirectoryIntent(target.value.node.id)
        : createKonquerorOpenFileIntent(target.value.node.id),
    );
  }

  return ok(intents);
}
