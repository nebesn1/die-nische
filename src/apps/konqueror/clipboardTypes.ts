import type { VfsNodeId } from "../../vfs/types";

export interface KonquerorClipboardEntry {
  readonly nodeId: VfsNodeId;
  readonly sourceParentId: VfsNodeId;
}

export type KonquerorClipboardState =
  | {
      readonly kind: "empty";
    }
  | {
      readonly kind: "items";
      readonly mode: "copy" | "cut";
      readonly entries: readonly KonquerorClipboardEntry[];
      /** Raw selected membership retained solely for Cut pending presentation. */
      readonly displayNodeIds: readonly VfsNodeId[];
    };

export type KonquerorClipboardAction =
  | {
      readonly type: "copy";
      readonly entries: readonly KonquerorClipboardEntry[];
      readonly displayNodeIds: readonly VfsNodeId[];
    }
  | {
      readonly type: "cut";
      readonly entries: readonly KonquerorClipboardEntry[];
      readonly displayNodeIds: readonly VfsNodeId[];
    }
  | {
      readonly type: "clear";
    };
