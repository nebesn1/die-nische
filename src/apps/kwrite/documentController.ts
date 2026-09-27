import { getVfsPathForNode, getVfsNodeById } from "../../vfs/queries";
import { isVfsTextFile } from "../../vfs/fileContent";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { isVfsNodeInsideTrash } from "../../vfs/tree";
import type { VfsError } from "../../vfs/errors";
import type { VfsNodeId, VfsState, VfsTextFileNode } from "../../vfs/types";
import type { VfsContextValue } from "../../vfs/VfsContext";
import {
  canSaveAsKWriteDocument,
  canSaveKWriteDocument,
  type KWriteDocumentState,
  type KWriteTextFileSnapshot,
} from "./documentModel";
import { serializeKWriteEditorText } from "./lineEndings";

export function getKWriteTextFileSnapshot(state: VfsState, nodeId: VfsNodeId): KWriteTextFileSnapshot | null {
  const node = getVfsNodeById(state, nodeId);

  if (!node.ok || !isVfsTextFile(node.value)) {
    return null;
  }

  const path = getVfsPathForNode(state, node.value.id);

  if (!path.ok) {
    return null;
  }

  return {
    nodeId: node.value.id,
    name: node.value.name,
    displayName: getVfsNodeDisplayName(node.value),
    path: path.value,
    content: node.value.content.text,
    modifiedAt: node.value.modifiedAt,
    isInsideTrash: isVfsNodeInsideTrash(state, node.value.id),
  };
}

export type KWriteSaveResult =
  | { readonly ok: true; readonly file: VfsTextFileNode }
  | { readonly ok: false; readonly error: VfsError };

export function createKWriteTextFileSnapshot(
  file: VfsTextFileNode,
  path: string,
): KWriteTextFileSnapshot {
  return {
    nodeId: file.id,
    name: file.name,
    displayName: getVfsNodeDisplayName(file),
    path,
    content: file.content.text,
    modifiedAt: file.modifiedAt,
    isInsideTrash: false,
  };
}

export function saveKWriteDocument(
  state: VfsState,
  document: KWriteDocumentState,
  operations: Pick<VfsContextValue, "writeTextFile">,
  now: string,
): KWriteSaveResult {
  if (!canSaveKWriteDocument(document) || document.nodeId === null) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "This document cannot be saved in its current state." },
    };
  }

  const current = getKWriteTextFileSnapshot(state, document.nodeId);

  if (!current) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "The text file is no longer available.", nodeId: document.nodeId },
    };
  }

  if (current.isInsideTrash) {
    return {
      ok: false,
      error: { code: "ALREADY_IN_TRASH", message: "Files in the Trash are read-only.", nodeId: document.nodeId },
    };
  }

  const written = operations.writeTextFile(
    current.path,
    serializeKWriteEditorText(document.draft, document.lineEnding),
    { now },
  );

  return written.ok ? { ok: true, file: written.value } : written;
}

export function saveKWriteDocumentAs(
  state: VfsState,
  document: KWriteDocumentState,
  operations: Pick<VfsContextValue, "createTextFile" | "writeTextFile">,
  destination: { readonly directoryPath: string; readonly name: string; readonly existingFilePath?: string },
  now: string,
): KWriteSaveResult {
  if (!canSaveAsKWriteDocument(document)) {
    return {
      ok: false,
      error: { code: "INVALID_DESTINATION", message: "This document cannot be saved as a text file." },
    };
  }

  const content = serializeKWriteEditorText(document.draft, document.lineEnding);
  const result = destination.existingFilePath
    ? operations.writeTextFile(destination.existingFilePath, content, { now })
    : operations.createTextFile(destination.directoryPath, destination.name, content, { now });

  return result.ok ? { ok: true, file: result.value } : result;
}
