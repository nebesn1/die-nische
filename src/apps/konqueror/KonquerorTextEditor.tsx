import type { KeyboardEvent } from "react";
import type { VfsTextFileNode } from "../../vfs/types";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { formatVfsByteSize, formatVfsModifiedTime } from "./formatters";
import { TextFileIcon } from "./icons";
import { KonquerorUnsavedIndicator } from "./KonquerorUnsavedIndicator";
import { formatKonquerorSaveError } from "./saveTextErrors";
import type { KonquerorEditorState } from "./editorTypes";
import { isKonquerorEditorDirty } from "./editorState";
import { useI18n } from "../../i18n/useI18n";

type KonquerorTextEditorProps = {
  readonly file: VfsTextFileNode;
  readonly editorState: Extract<KonquerorEditorState, { readonly kind: "editing" }>;
  readonly draftSize: number;
  readonly onChangeDraft: (content: string) => void;
  readonly onSave: () => void;
  readonly onDiscardClean: () => void;
  readonly onClearError: () => void;
};

export function KonquerorTextEditor({
  draftSize,
  editorState,
  file,
  onChangeDraft,
  onClearError,
  onDiscardClean,
  onSave,
}: KonquerorTextEditorProps) {
  const { locale, t } = useI18n();
  const isDirty = isKonquerorEditorDirty(editorState);
  const displayName = getVfsNodeDisplayName(file);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      onSave();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      if (editorState.saveError) {
        onClearError();
        return;
      }

      if (!isDirty) {
        onDiscardClean();
      }
    }
  };

  return (
    <article className="konqueror-file-view konqueror-text-editor-view" aria-label={t("konqueror.preview.textEditor", { name: displayName })}>
      <header className="konqueror-file-view__header">
        <TextFileIcon className="konqueror-file-view__icon" aria-hidden="true" focusable="false" />
        <div>
          <h2>{displayName}</h2>
          <p>
            {file.mimeType} - {formatVfsByteSize(draftSize)} - {t("konqueror.status.modified")} {formatVfsModifiedTime(file.modifiedAt, { locale })}
          </p>
        </div>
        <KonquerorUnsavedIndicator isDirty={isDirty} />
      </header>
      {editorState.saveError ? (
        <div className="konqueror-save-error" role="alert">
          <strong>{t("konqueror.error.fileUnavailable")}:</strong> {formatKonquerorSaveError(editorState.saveError)}
        </div>
      ) : null}
      <textarea
        className="konqueror-text-editor"
        value={editorState.draftContent}
        aria-label={`${t("konqueror.menu.edit")} ${file.name}`}
        spellCheck={false}
        onChange={(event) => onChangeDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
    </article>
  );
}
