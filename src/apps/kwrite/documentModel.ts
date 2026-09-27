import type { VfsNodeId } from "../../vfs/types";
import {
  detectKWriteLineEnding,
  normalizeKWriteEditorText,
  type KWriteLineEnding,
} from "./lineEndings";

export type KWriteDocumentMode =
  | "untitled"
  | "writable"
  | "trash-read-only"
  | "mixed-read-only"
  | "conflict"
  | "unavailable";

export interface KWriteTextFileSnapshot {
  readonly nodeId: VfsNodeId;
  readonly name: string;
  /** Optional user-facing VFS presentation label; canonical save identity stays `name`/`path`. */
  readonly displayName?: string;
  readonly path: string;
  readonly content: string;
  readonly modifiedAt: string;
  readonly isInsideTrash: boolean;
}

export interface KWriteDocumentState {
  readonly nodeId: VfsNodeId | null;
  readonly draft: string;
  readonly baselineContent: string;
  readonly baselineModifiedAt: string | null;
  readonly lineEnding: KWriteLineEnding;
  readonly mode: KWriteDocumentMode;
  readonly dirty: boolean;
  readonly lastKnownName: string;
  readonly lastKnownDisplayName: string;
  readonly lastKnownPath: string | null;
  readonly notice: string | null;
}

export const createInitialKWriteDocumentState = (): KWriteDocumentState => ({
  nodeId: null,
  draft: "",
  baselineContent: "",
  baselineModifiedAt: null,
  lineEnding: "none",
  mode: "untitled",
  dirty: false,
  lastKnownName: "Untitled",
  lastKnownDisplayName: "Untitled",
  lastKnownPath: null,
  notice: null,
});

export const initialKWriteDocumentState: KWriteDocumentState = createInitialKWriteDocumentState();

/** Application-owned base caption; shell collision suffixes are derived separately. */
export function getKWriteDocumentBaseTitle(state: KWriteDocumentState): string {
  return `${state.lastKnownDisplayName} - KWrite`;
}

const withDraft = (state: KWriteDocumentState, draft: string, notice: string | null = null): KWriteDocumentState => ({
  ...state,
  draft,
  dirty: draft !== state.baselineContent,
  notice,
});

const withSynchronizedLocation = (
  state: KWriteDocumentState,
  snapshot: KWriteTextFileSnapshot,
  mode: KWriteDocumentMode,
  baselineModifiedAt: string | null,
  notice: string | null = state.notice,
): KWriteDocumentState => {
  const displayName = snapshot.displayName ?? snapshot.name;

  if (
    state.mode === mode &&
    state.baselineModifiedAt === baselineModifiedAt &&
    state.lastKnownName === snapshot.name &&
    state.lastKnownDisplayName === displayName &&
    state.lastKnownPath === snapshot.path &&
    state.notice === notice
  ) {
    return state;
  }

  return {
    ...state,
    mode,
    baselineModifiedAt,
    lastKnownName: snapshot.name,
    lastKnownDisplayName: displayName,
    lastKnownPath: snapshot.path,
    notice,
  };
};

export function loadKWriteDocument(snapshot: KWriteTextFileSnapshot): KWriteDocumentState {
  const lineEnding = detectKWriteLineEnding(snapshot.content);
  const content = normalizeKWriteEditorText(snapshot.content);

  return {
    nodeId: snapshot.nodeId,
    draft: content,
    baselineContent: content,
    baselineModifiedAt: snapshot.modifiedAt,
    lineEnding,
    mode: lineEnding === "mixed" ? "mixed-read-only" : snapshot.isInsideTrash ? "trash-read-only" : "writable",
    dirty: false,
    lastKnownName: snapshot.name,
    lastKnownDisplayName: snapshot.displayName ?? snapshot.name,
    lastKnownPath: snapshot.path,
    notice: null,
  };
}

export function editKWriteDocument(state: KWriteDocumentState, draft: string): KWriteDocumentState {
  if (state.mode !== "untitled" && state.mode !== "writable") {
    return state;
  }

  return withDraft(state, draft);
}

export function canSaveKWriteDocument(state: KWriteDocumentState): boolean {
  return state.nodeId !== null && state.mode === "writable" && state.dirty;
}

export function canRevertKWriteDocument(state: KWriteDocumentState): boolean {
  return state.mode !== "unavailable" && (state.dirty || state.mode === "conflict");
}

export function canSaveAsKWriteDocument(state: KWriteDocumentState): boolean {
  return state.mode !== "mixed-read-only";
}

export function requestKWriteDocument(
  state: KWriteDocumentState,
  snapshot: KWriteTextFileSnapshot | null,
): KWriteDocumentState {
  if (state.dirty) {
    if (snapshot !== null && snapshot.nodeId === state.nodeId) {
      return state;
    }

    return {
      ...state,
      notice: "Unsaved changes prevent opening another file.",
    };
  }

  if (snapshot === null) {
    return {
      ...state,
      mode: "unavailable",
      notice: "The requested text file is no longer available.",
    };
  }

  return loadKWriteDocument(snapshot);
}

export function synchronizeKWriteDocument(
  state: KWriteDocumentState,
  snapshot: KWriteTextFileSnapshot | null,
): KWriteDocumentState {
  if (state.nodeId === null) {
    return state;
  }

  if (snapshot === null) {
    return state.mode === "unavailable"
      ? state
      : {
        ...state,
        mode: "unavailable",
        notice: null,
      };
  }

  const latestLineEnding = detectKWriteLineEnding(snapshot.content);
  const normalizedContent = normalizeKWriteEditorText(snapshot.content);
  const externalContentChange = normalizedContent !== state.baselineContent || latestLineEnding !== state.lineEnding;
  const metadataChanged = snapshot.modifiedAt !== state.baselineModifiedAt;

  if (latestLineEnding === "mixed") {
    return state.dirty
      ? withSynchronizedLocation(state, snapshot, "mixed-read-only", state.baselineModifiedAt)
      : loadKWriteDocument(snapshot);
  }

  if (snapshot.isInsideTrash) {
    return state.dirty
      ? withSynchronizedLocation(
        state,
        snapshot,
        "trash-read-only",
        externalContentChange ? state.baselineModifiedAt : snapshot.modifiedAt,
      )
      : externalContentChange || metadataChanged || state.mode !== "trash-read-only"
      ? loadKWriteDocument(snapshot)
      : withSynchronizedLocation(state, snapshot, "trash-read-only", snapshot.modifiedAt);
  }

  if (externalContentChange) {
    return state.dirty
      ? withSynchronizedLocation(state, snapshot, "conflict", state.baselineModifiedAt, null)
      : loadKWriteDocument(snapshot);
  }

  if (!state.dirty) {
    return metadataChanged || state.mode !== "writable" || state.lastKnownPath !== snapshot.path || state.lastKnownName !== snapshot.name || state.lastKnownDisplayName !== (snapshot.displayName ?? snapshot.name)
      ? loadKWriteDocument(snapshot)
      : state;
  }

  return withSynchronizedLocation(state, snapshot, "writable", snapshot.modifiedAt);
}

export function revertKWriteDocument(
  state: KWriteDocumentState,
  snapshot: KWriteTextFileSnapshot | null,
): KWriteDocumentState {
  if (state.nodeId === null) {
    return initialKWriteDocumentState;
  }

  return snapshot === null ? state : loadKWriteDocument(snapshot);
}

export function saveSucceededKWriteDocument(
  state: KWriteDocumentState,
  snapshot: KWriteTextFileSnapshot,
): KWriteDocumentState {
  const loaded = loadKWriteDocument(snapshot);

  return {
    ...loaded,
    notice: "Saved",
  };
}

export function saveFailedKWriteDocument(state: KWriteDocumentState, message: string): KWriteDocumentState {
  return {
    ...state,
    notice: message,
  };
}

export function getKWriteDocumentStatus(state: KWriteDocumentState): string {
  if (state.notice) {
    return state.notice;
  }

  if (state.mode === "unavailable") {
    return "File is no longer available";
  }

  if (state.mode === "conflict") {
    return "External changes detected";
  }

  if (state.mode === "trash-read-only") {
    return "Read-only - file is in Trash";
  }

  if (state.mode === "mixed-read-only") {
    return "Read-only - mixed line endings are not editable in this version";
  }

  if (state.mode === "untitled") {
    return state.dirty ? "Modified" : "Untitled - no backing file";
  }

  return state.dirty ? "Modified" : "Saved";
}
