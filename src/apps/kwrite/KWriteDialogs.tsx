import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import type { VfsNode, VfsNodeId, VfsState } from "../../vfs/types";
import { getKWriteDialogDirectory } from "./dialogController";
import type { KWriteDialogError, KWriteDialogState } from "./dialogModel";
import { useI18n } from "../../i18n/useI18n";
import { translateKWriteReplacementMessage } from "./kwriteI18n";

type KWriteDialogsProps = {
  readonly dialog: KWriteDialogState;
  readonly state: VfsState;
  readonly canSaveReplacement: boolean;
  readonly onCancel: () => void;
  readonly onDiscardReplacement: () => void;
  readonly onSaveReplacement: () => void;
  readonly onDiscardClose: () => void;
  readonly onSaveClose: () => void;
  readonly onSelectNode: (nodeId: VfsNodeId | null, nodeKind: VfsNode["kind"] | null) => void;
  readonly onGoUp: () => void;
  readonly onGoHome: () => void;
  readonly onOpenSelection: () => void;
  readonly onActivateNode: (nodeId: VfsNodeId) => void;
  readonly onChangeFilename: (filename: string) => void;
  readonly onSaveAs: () => void;
  readonly onReplace: () => void;
};

const isSelected = (selectedNodeId: VfsNodeId | null, nodeId: VfsNodeId): boolean => selectedNodeId === nodeId;

const renderDialogError = (error: KWriteDialogError, t: ReturnType<typeof useI18n>["t"]): string =>
  error.type === "translation" ? t(error.key) : error.message;

export function KWriteDialogs({
  dialog,
  state,
  canSaveReplacement,
  onCancel,
  onChangeFilename,
  onDiscardReplacement,
  onDiscardClose,
  onGoHome,
  onGoUp,
  onOpenSelection,
  onActivateNode,
  onReplace,
  onSaveAs,
  onSaveReplacement,
  onSaveClose,
  onSelectNode,
}: KWriteDialogsProps) {
  const { t } = useI18n();
  const filenameInputRef = useRef<HTMLInputElement>(null);
  const dialogTitleId = useId();

  useEffect(() => {
    if (dialog.type === "save-as") {
      filenameInputRef.current?.focus();
      filenameInputRef.current?.select();
    }
  }, [dialog.type]);

  if (dialog.type === "none") {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  if (dialog.type === "confirm-replacement") {
    return (
      <div className="kwrite-dialog-backdrop" onKeyDown={handleKeyDown}>
        <section className="kwrite-dialog kwrite-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby={dialogTitleId}>
          <h2 id={dialogTitleId}>KWrite</h2>
          <p>{t("kwrite.confirmUnsaved")}</p>
          <p>{translateKWriteReplacementMessage(dialog.pending.action, t)}</p>
          {dialog.error ? <div className="kwrite-dialog-error" role="alert">{renderDialogError(dialog.error, t)}</div> : null}
          <div className="kwrite-dialog-actions">
            <button type="button" className="kde-raised kwrite-dialog-button" disabled={!canSaveReplacement} onClick={onSaveReplacement}>{t("kwrite.save")}</button>
            <button type="button" className="kde-raised kwrite-dialog-button" onClick={onDiscardReplacement}>{t("kwrite.discard")}</button>
            <button type="button" className="kde-raised kwrite-dialog-button" onClick={onCancel}>{t("common.cancel")}</button>
          </div>
        </section>
      </div>
    );
  }

  if (dialog.type === "confirm-close") {
    return (
      <div className="kwrite-dialog-backdrop" onKeyDown={handleKeyDown}>
        <section className="kwrite-dialog kwrite-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby={dialogTitleId}>
          <h2 id={dialogTitleId}>KWrite</h2>
          <p>{t("kwrite.confirmUnsaved")}</p>
          <p>{t("kwrite.saveBeforeClose")}</p>
          {dialog.error ? <div className="kwrite-dialog-error" role="alert">{renderDialogError(dialog.error, t)}</div> : null}
          <div className="kwrite-dialog-actions">
            <button type="button" className="kde-raised kwrite-dialog-button" disabled={!canSaveReplacement} onClick={onSaveClose}>{t("kwrite.save")}</button>
            <button type="button" className="kde-raised kwrite-dialog-button" onClick={onDiscardClose}>{t("kwrite.discard")}</button>
            <button type="button" className="kde-raised kwrite-dialog-button" onClick={onCancel}>{t("common.cancel")}</button>
          </div>
        </section>
      </div>
    );
  }

  if (dialog.type === "confirm-overwrite") {
    return (
      <div className="kwrite-dialog-backdrop" onKeyDown={handleKeyDown}>
        <section className="kwrite-dialog kwrite-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby={dialogTitleId}>
          <h2 id={dialogTitleId}>{t("kwrite.replaceFile")}</h2>
          <p>{t("kwrite.fileExists", { filename: dialog.filename })}</p>
          <p>{t("kwrite.replaceIt")}</p>
          {dialog.error ? <div className="kwrite-dialog-error" role="alert">{renderDialogError(dialog.error, t)}</div> : null}
          <div className="kwrite-dialog-actions">
            <button type="button" className="kde-raised kwrite-dialog-button" onClick={onReplace}>{t("kfind.replace")}</button>
            <button type="button" className="kde-raised kwrite-dialog-button" onClick={onCancel}>{t("common.cancel")}</button>
          </div>
        </section>
      </div>
    );
  }

  const directory = getKWriteDialogDirectory(state, dialog.directoryNodeId);
  const isOpenDialog = dialog.type === "open";
  const selectedNodeId = dialog.selectedNodeId;
  const error = directory ? dialog.error : { type: "translation" as const, key: "kfind.directoryUnavailable" as const };
  const canUseDirectory = directory !== null && (isOpenDialog || !directory.isInsideTrash);

  return (
    <div className="kwrite-dialog-backdrop" onKeyDown={handleKeyDown}>
      <section className="kwrite-dialog kwrite-vfs-dialog" role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}>
        <h2 id={dialogTitleId}>{isOpenDialog ? t("kwrite.openFile") : t("kwrite.saveFileAs")}</h2>
        <div className="kwrite-dialog-location">{t("kfind.location")} {directory?.path ?? t("kfind.unavailable")}</div>
        <div className="kwrite-dialog-navigation">
          <button type="button" className="kde-raised kwrite-dialog-button" disabled={!directory?.node.parentId} onClick={onGoUp}>{t("kfind.up")}</button>
          <button type="button" className="kde-raised kwrite-dialog-button" onClick={onGoHome}>{t("kfind.home")}</button>
        </div>
        <div className="kwrite-dialog-file-list" role="listbox" aria-label={t("kwrite.vfsFiles")}>
          {directory?.children.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`kwrite-dialog-file-row${isSelected(selectedNodeId, node.id) ? " is-selected" : ""}`}
              role="option"
              aria-selected={isSelected(selectedNodeId, node.id)}
              onClick={() => onSelectNode(node.id, node.kind)}
              onDoubleClick={() => onActivateNode(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onActivateNode(node.id);
                }
              }}
            >
              <span>{node.name}</span>
              <span>{node.kind === "directory" ? t("kwrite.folder") : node.kind === "link" ? t("kwrite.link") : t("kwrite.textFile")}</span>
            </button>
          ))}
        </div>
        {!isOpenDialog ? (
          <label className="kwrite-dialog-filename">
            {t("kwrite.fileName")}
            <input
              ref={filenameInputRef}
              value={dialog.filename}
              onChange={(event) => onChangeFilename(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSaveAs();
                }
              }}
            />
          </label>
        ) : null}
        {error ? <div className="kwrite-dialog-error" role="alert">{renderDialogError(error, t)}</div> : null}
        <div className="kwrite-dialog-actions">
          <button
            type="button"
            className="kde-raised kwrite-dialog-button"
            disabled={!canUseDirectory || (isOpenDialog && selectedNodeId === null)}
            onClick={isOpenDialog ? onOpenSelection : onSaveAs}
          >
            {isOpenDialog ? t("kwrite.openDialog") : t("kwrite.saveDialog")}
          </button>
          <button type="button" className="kde-raised kwrite-dialog-button" onClick={onCancel}>{t("common.cancel")}</button>
        </div>
      </section>
    </div>
  );
}
