import { useEffect, useId, useRef, type FormEvent, type KeyboardEvent } from "react";
import type { KonquerorDirectTransferDialogState } from "./directTransferTypes";
import { formatKonquerorMutationError } from "./mutationErrors";
import { useI18n } from "../../i18n/useI18n";

type KonquerorDirectTransferDialogProps = {
  readonly dialogState: KonquerorDirectTransferDialogState;
  readonly onChangeDestination: (destination: string) => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
};

export function KonquerorDirectTransferDialog({
  dialogState,
  onChangeDestination,
  onCancel,
  onSubmit,
}: KonquerorDirectTransferDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialogState.kind === "open") inputRef.current?.focus();
  }, [dialogState.kind]);

  if (dialogState.kind === "closed") return null;

  const title = dialogState.request.kind === "copy" ? t("konqueror.dialog.copyFiles") : t("konqueror.dialog.moveFiles");
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };

  return (
    <div className="konqueror-dialog-backdrop" onKeyDown={handleKeyDown}>
      <section className="konqueror-input-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <form onSubmit={handleSubmit}>
          <h2 id={titleId}>{title}</h2>
          <label htmlFor={inputId}>{t("konqueror.dialog.destinationFolder")}</label>
          <input
            ref={inputRef}
            id={inputId}
            className="konqueror-dialog-input"
            value={dialogState.destinationDraft}
            onChange={(event) => onChangeDestination(event.currentTarget.value)}
          />
          {dialogState.error ? (
            <div className="konqueror-dialog-error" role="alert">{formatKonquerorMutationError(dialogState.error)}</div>
          ) : null}
          <div className="konqueror-dialog-actions">
          <button type="submit" className="kde-raised konqueror-dialog-button">{t("konqueror.dialog.ok")}</button>
          <button type="button" className="kde-raised konqueror-dialog-button" onClick={onCancel}>{t("konqueror.dialog.cancel")}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
