import type { VfsError } from "../../vfs/errors";
import { isVfsTextFile } from "../../vfs/fileContent";
import { getVfsNodeById, getVfsPathForNode } from "../../vfs/queries";
import type { VfsResult } from "../../vfs/result";
import type { VfsNodeId, VfsState, VfsTextFileNode } from "../../vfs/types";
import type { VfsContextValue } from "../../vfs/VfsContext";
import type { KonquerorEditorEnvironment, KonquerorEditorState } from "./editorTypes";

export type KonquerorSaveOperations = Pick<VfsContextValue, "writeTextFile" | "readTextFile">;

export interface KonquerorSaveSuccess {
  readonly nodeId: VfsNodeId;
  readonly file: VfsTextFileNode;
}

export type KonquerorSaveResult =
  | {
      readonly ok: true;
      readonly value: KonquerorSaveSuccess;
    }
  | {
      readonly ok: false;
      readonly error: VfsError;
    };

const fail = (error: VfsError): KonquerorSaveResult => ({
  ok: false,
  error,
});

const ok = (value: KonquerorSaveSuccess): KonquerorSaveResult => ({
  ok: true,
  value,
});

export function saveKonquerorTextFile(
  state: VfsState,
  editorState: KonquerorEditorState,
  operations: KonquerorSaveOperations,
  environment: KonquerorEditorEnvironment,
): KonquerorSaveResult {
  if (editorState.kind !== "editing") {
    return fail({
      code: "NOT_FOUND",
      message: "No Konqueror text editor is open.",
    });
  }

  const node = getVfsNodeById(state, editorState.targetNodeId);

  if (!node.ok) {
    return fail(node.error);
  }

  if (node.value.kind !== "file") {
    return fail({
      code: "IS_DIRECTORY",
      message: "The selected item is not a UTF-8 text file.",
      nodeId: node.value.id,
    });
  }

  if (!isVfsTextFile(node.value)) {
    return fail({
      code: "UNSUPPORTED_FILE_CONTENT",
      message: "The selected file is not backed by editable text.",
      nodeId: node.value.id,
    });
  }

  const path = getVfsPathForNode(state, node.value.id);

  if (!path.ok) {
    return fail(path.error);
  }

  const written = operations.writeTextFile(path.value, editorState.draftContent, {
    now: environment.now(),
  });

  if (!written.ok) {
    return fail(written.error);
  }

  return ok({
    nodeId: written.value.id,
    file: written.value,
  });
}

export function readLatestSavedTextFile(
  state: VfsState,
  nodeId: VfsNodeId,
  operations: Pick<VfsContextValue, "readTextFile">,
): VfsResult<VfsTextFileNode> {
  const path = getVfsPathForNode(state, nodeId);

  return path.ok ? operations.readTextFile(path.value) : path;
}
