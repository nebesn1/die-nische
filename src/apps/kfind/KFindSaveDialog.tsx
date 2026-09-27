import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { getVfsDialogDirectory } from "../../vfs/vfsDialogController";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import type { KFindSaveDialogState } from "./saveDialogModel";
import { useI18n } from "../../i18n/useI18n";

type KFindSaveDialogProps = {
  readonly dialog: KFindSaveDialogState;
  readonly state: VfsState;
  readonly onCancel: () => void;
  readonly onGoUp: () => void;
  readonly onGoHome: () => void;
  readonly onSelectDirectory: (nodeId: VfsNodeId) => void;
  readonly onOpenDirectory: (nodeId: VfsNodeId) => void;
  readonly onChangeFilename: (filename: string) => void;
  readonly onChangeAutoExtension: (autoExtension: boolean) => void;
  readonly onSave: () => void;
  readonly onReplace: () => void;
};

export function KFindSaveDialog({ dialog, state, onCancel, onChangeAutoExtension, onChangeFilename, onGoHome, onGoUp, onOpenDirectory, onReplace, onSave, onSelectDirectory }: KFindSaveDialogProps) {
  const { t } = useI18n();
  const filenameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (dialog.type === "save") filenameInputRef.current?.focus();
  }, [dialog.type]);
  if (dialog.type === "none") return null;

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onCancel(); }
  };
  if (dialog.type === "overwrite") {
    return <div className="kfind-dialog-backdrop" onKeyDown={keyDown}>
      <section className="kfind-dialog kfind-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{t("kfind.replaceFile")}</h2><p>{t("kfind.fileExists", { filename: dialog.filename })}</p><p>{t("kfind.replaceIt")}</p>
        {dialog.error ? <div className="kfind-dialog-error" role="alert">{dialog.error}</div> : null}
        <div className="kfind-dialog-actions"><button type="button" className="kde-raised" onClick={onReplace}>{t("kfind.replace")}</button><button type="button" className="kde-raised" onClick={onCancel}>{t("common.cancel")}</button></div>
      </section>
    </div>;
  }

  const directory = getVfsDialogDirectory(state, dialog.directoryNodeId);
  const error = directory ? dialog.error : t("kfind.directoryUnavailable");
  return <div className="kfind-dialog-backdrop" onKeyDown={keyDown}>
    <section className="kfind-dialog kfind-save-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId}>{t("kfind.saveResultsAs")}</h2>
      <div className="kfind-dialog-location">{t("kfind.location")} {directory?.path ?? t("kfind.unavailable")}</div>
      <div className="kfind-dialog-toolbar"><button type="button" className="kde-raised" disabled={!directory?.node.parentId} onClick={onGoUp}>{t("kfind.up")}</button><button type="button" className="kde-raised" onClick={onGoHome}>{t("kfind.home")}</button></div>
      <div className="kfind-directory-list" role="listbox" aria-label={t("kfind.vfsFiles")}>
        {directory?.children.map((node) => <button key={node.id} type="button" role="option" aria-selected={dialog.selectedDirectoryNodeId === node.id} className={dialog.selectedDirectoryNodeId === node.id ? "is-selected" : ""} onDoubleClick={() => node.kind === "directory" && onOpenDirectory(node.id)} onClick={() => node.kind === "directory" && onSelectDirectory(node.id)}><span>{node.name}</span><span>{node.kind === "directory" ? t("kwrite.folder") : t("kwrite.textFile")}</span></button>)}
      </div>
      <label className="kfind-save-field">{t("kfind.location")}<input ref={filenameInputRef} value={dialog.filename} onChange={(event) => onChangeFilename(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSave(); } }} /></label>
      <label className="kfind-save-field">{t("kfind.filter")}<select aria-label={t("kfind.filter")} value="plain-text" disabled><option value="plain-text">{t("kfind.plainTextDocument")}</option></select></label>
      <label className="kfind-checkbox"><input type="checkbox" checked={dialog.autoExtension} onChange={(event) => onChangeAutoExtension(event.currentTarget.checked)} />{t("kfind.autoExtension")}</label>
      {error ? <div className="kfind-dialog-error" role="alert">{error}</div> : null}
      <div className="kfind-dialog-actions"><button type="button" className="kde-raised" disabled={!directory} onClick={onSave}>{t("kwrite.save")}</button><button type="button" className="kde-raised" onClick={onCancel}>{t("common.cancel")}</button></div>
    </section>
  </div>;
}
