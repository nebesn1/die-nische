import { isVfsTextFile } from "../../vfs/fileContent";
import type { VfsTextFileNode } from "../../vfs/types";
import type { KonquerorEditorState } from "./editorTypes";
import { isKonquerorEditorDirty } from "./editorState";
import type { KonquerorView } from "./navigationTypes";

export interface KonquerorEditorAvailability {
  readonly canEdit: boolean;
  readonly canSave: boolean;
  readonly canDiscard: boolean;
  readonly isEditing: boolean;
  readonly isDirty: boolean;
  readonly navigationDisabled: boolean;
  readonly editTitle: string;
  readonly saveTitle: string;
  readonly discardTitle: string;
  readonly navigationDisabledTitle: string;
}

const getTextFileFromView = (view: KonquerorView): VfsTextFileNode | null => {
  return view.type === "file" && isVfsTextFile(view.node) ? view.node : null;
};

export function getKonquerorEditorAvailability(
  view: KonquerorView,
  editorState: KonquerorEditorState,
): KonquerorEditorAvailability {
  const isEditing = editorState.kind === "editing";
  const isDirty = isKonquerorEditorDirty(editorState);
  const file = getTextFileFromView(view);
  const canEdit = Boolean(file) && !isEditing;
  const navigationDisabledTitle = "Save or discard changes before navigating";

  return {
    canEdit,
    canSave: isEditing && isDirty,
    canDiscard: isEditing,
    isEditing,
    isDirty,
    navigationDisabled: isEditing,
    editTitle: canEdit ? "Edit Text File" : isEditing ? "Already editing this text file" : "Open a text file before editing",
    saveTitle: isEditing ? (isDirty ? "Save" : "No changes to save") : "Edit a text file before saving",
    discardTitle: isEditing ? "Discard Changes" : "Edit a text file before discarding changes",
    navigationDisabledTitle,
  };
}
