import type { VfsError } from "../../vfs/errors";
import type { VfsNodeId } from "../../vfs/types";

export type KonquerorCommandDialogState =
  | {
      readonly kind: "closed";
    }
  | {
      readonly kind: "new-folder";
      readonly parentNodeId: VfsNodeId;
      readonly preserveSelection: boolean;
      readonly draftName: string;
      readonly error: VfsError | null;
    }
  | {
      readonly kind: "new-text-file";
      readonly parentNodeId: VfsNodeId;
      readonly draftName: string;
      readonly error: VfsError | null;
    }
  | {
      readonly kind: "rename";
      readonly targetNodeId: VfsNodeId;
      readonly originalName: string;
      readonly draftName: string;
      readonly error: VfsError | null;
    };

export type KonquerorCommandAction =
  | {
      readonly type: "open-new-folder";
      readonly parentNodeId: VfsNodeId;
      /** Item-menu creation keeps the existing selection and range anchor intact. */
      readonly preserveSelection?: boolean;
    }
  | {
      readonly type: "open-new-text-file";
      readonly parentNodeId: VfsNodeId;
    }
  | {
      readonly type: "open-rename";
      readonly targetNodeId: VfsNodeId;
      readonly originalName: string;
    }
  | {
      readonly type: "set-draft-name";
      readonly draftName: string;
    }
  | {
      readonly type: "set-error";
      readonly error: VfsError;
    }
  | {
      readonly type: "close";
    };

export interface KonquerorCommandEnvironment {
  readonly now: () => string;
}

export const defaultKonquerorCommandEnvironment: KonquerorCommandEnvironment = {
  now: () => new Date().toISOString(),
};
