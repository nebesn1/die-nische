import type { VfsError } from "../../vfs/errors";
import type { VfsNodeId } from "../../vfs/types";

export type KonquerorEditorState =
  | {
      readonly kind: "closed";
    }
  | {
      readonly kind: "editing";
      readonly targetNodeId: VfsNodeId;
      readonly originalContent: string;
      readonly draftContent: string;
      readonly originalModifiedAt: string;
      readonly saveError: VfsError | null;
    };

export type KonquerorEditorAction =
  | {
      readonly type: "open";
      readonly targetNodeId: VfsNodeId;
      readonly content: string;
      readonly modifiedAt: string;
    }
  | {
      readonly type: "set-draft-content";
      readonly draftContent: string;
    }
  | {
      readonly type: "set-save-error";
      readonly error: VfsError;
    }
  | {
      readonly type: "clear-save-error";
    }
  | {
      readonly type: "close";
    };

export interface KonquerorEditorEnvironment {
  readonly now: () => string;
}
