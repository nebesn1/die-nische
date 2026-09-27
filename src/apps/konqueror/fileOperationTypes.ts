import type { VfsError } from "../../vfs/errors";
import type { VfsNodeId } from "../../vfs/types";
import type { KonquerorFileOperationErrorContext } from "./operationErrors";

export type KonquerorConfirmationState =
  | {
      readonly kind: "closed";
    }
  | {
      readonly kind: "move-to-trash";
      readonly targetNodeIds: readonly VfsNodeId[];
      readonly operationRootNodeIds: readonly VfsNodeId[];
      readonly targetLabel: string;
      /** DnD is a direct operation and must not affect the shared clipboard. */
      readonly preserveClipboard?: boolean;
      readonly error: VfsError | null;
    }
  | {
      readonly kind: "delete-permanently";
      readonly targetNodeIds: readonly VfsNodeId[];
      readonly targetLabel: string;
      readonly error: VfsError | null;
    }
  | {
      readonly kind: "empty-trash";
      readonly error: VfsError | null;
    };

export type KonquerorConfirmationAction =
  | {
      readonly type: "open-move-to-trash";
      readonly targetNodeIds: readonly VfsNodeId[];
      readonly operationRootNodeIds: readonly VfsNodeId[];
      readonly targetLabel: string;
      readonly preserveClipboard?: boolean;
    }
  | {
      readonly type: "open-delete-permanently";
      readonly targetNodeIds: readonly VfsNodeId[];
      readonly targetLabel: string;
    }
  | {
      readonly type: "open-empty-trash";
    }
  | {
      readonly type: "set-error";
      readonly error: VfsError;
    }
  | {
      readonly type: "close";
    };

export interface KonquerorFileOperationState {
  readonly error: VfsError | null;
  readonly errorContext: KonquerorFileOperationErrorContext | null;
  readonly statusMessage: string | null;
  readonly blockedLaunchMessage: string | null;
}

export type KonquerorFileOperationAction =
  | {
      readonly type: "set-error";
      readonly error: VfsError;
      readonly errorContext?: KonquerorFileOperationErrorContext;
    }
  | {
      readonly type: "set-status";
      readonly statusMessage: string;
    }
  | {
      readonly type: "set-blocked-launch";
      readonly message: string;
    }
  | {
      readonly type: "clear";
    };
