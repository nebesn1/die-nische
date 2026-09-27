import { useEffect, useRef, type KeyboardEvent } from "react";
import { formatKonquerorFileOperationError } from "./operationErrors";
import type { KonquerorConfirmationState } from "./fileOperationTypes";
import { useI18n } from "../../i18n/useI18n";

type KonquerorConfirmationDialogProps = {
  readonly confirmationState: KonquerorConfirmationState;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
};

export function KonquerorConfirmationDialog({
  confirmationState,
  onCancel,
  onSubmit,
}: KonquerorConfirmationDialogProps) {
  const { t } = useI18n();
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (confirmationState.kind !== "closed") {
      submitButtonRef.current?.focus();
    }
  }, [confirmationState.kind]);

  if (confirmationState.kind === "closed") {
    return null;
  }

  const dialogId = `konqueror-${confirmationState.kind}-dialog-title`;
  const title =
    confirmationState.kind === "move-to-trash"
      ? t("konqueror.dialog.moveToTrash")
      : confirmationState.kind === "delete-permanently"
      ? t("konqueror.dialog.deletePermanently")
      : t("konqueror.dialog.emptyTrash");
  const submitLabel =
    confirmationState.kind === "move-to-trash"
      ? t("konqueror.dialog.moveToTrash")
      : confirmationState.kind === "delete-permanently"
      ? t("konqueror.dialog.deletePermanently")
      : t("konqueror.dialog.emptyTrash");
  const message =
    confirmationState.kind === "move-to-trash"
      ? t("konqueror.dialog.moveQuestion", { name: confirmationState.targetLabel })
      : confirmationState.kind === "delete-permanently"
      ? t("konqueror.dialog.deleteQuestion", { name: confirmationState.targetLabel })
      : t("konqueror.dialog.emptyTrashQuestion");

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="konqueror-dialog-backdrop">
      <section
        className="konqueror-input-dialog konqueror-confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        onKeyDown={handleKeyDown}
      >
        <div className="konqueror-confirmation-dialog__body">
          <h2 id={dialogId}>{title}</h2>
          <p>{message}</p>
          {confirmationState.kind === "delete-permanently" || confirmationState.kind === "empty-trash" ? (
            <p>{t("konqueror.dialog.cannotUndo")}</p>
          ) : null}
          {confirmationState.error ? (
            <div className="konqueror-dialog-error" role="alert">
              {formatKonquerorFileOperationError(
                confirmationState.error,
                confirmationState.kind === "move-to-trash"
                  ? "move-to-trash"
                  : confirmationState.kind === "delete-permanently" || confirmationState.kind === "empty-trash"
                  ? "trash"
                  : "clipboard",
                t,
              )}
            </div>
          ) : null}
          <div className="konqueror-dialog-actions">
            <button ref={submitButtonRef} type="button" className="kde-raised konqueror-dialog-button" onClick={onSubmit}>
              {submitLabel}
            </button>
            <button type="button" className="kde-raised konqueror-dialog-button" onClick={onCancel}>
              {t("konqueror.dialog.cancel")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
