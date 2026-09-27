import type { VfsError } from "../../vfs/errors";
import type { VfsNodeId } from "../../vfs/types";
import type { KonquerorDragOperationPlan } from "./dragDropController";

export type KonquerorDirectTransferKind = "copy" | "move";
export type KonquerorDirectTransferSourceKind = "selection" | "current-directory" | "current-file" | "context-item";

/** A window-owned operation request freezes source identity before a destination is entered. */
export type KonquerorDirectTransferRequest = KonquerorDragOperationPlan & {
  readonly kind: KonquerorDirectTransferKind;
  readonly sourceKind: KonquerorDirectTransferSourceKind;
  readonly ownerWindowId: string;
  readonly sourceLocationNodeId: VfsNodeId;
};

export type KonquerorDirectTransferDialogState =
  | { readonly kind: "closed" }
  | {
      readonly kind: "open";
      readonly request: KonquerorDirectTransferRequest;
      readonly destinationDraft: string;
      readonly error: VfsError | null;
    };

export type KonquerorDirectTransferDialogAction =
  | {
      readonly type: "open";
      readonly request: KonquerorDirectTransferRequest;
      readonly destinationDraft: string;
    }
  | { readonly type: "set-destination-draft"; readonly destinationDraft: string }
  | { readonly type: "set-error"; readonly error: VfsError }
  | { readonly type: "close" };
