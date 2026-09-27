import { useEffect, useId, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { KonquerorCommandDialogState } from "./commandTypes";
import { formatKonquerorMutationError } from "./mutationErrors";
import { useI18n } from "../../i18n/useI18n";
import type { Translator } from "../../i18n/I18nContext";

type KonquerorInputDialogProps = {
  readonly dialogState: KonquerorCommandDialogState;
  readonly onChangeDraft: (draftName: string) => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
};

type KonquerorTextInputDialogProps = {
  readonly title: string;
  readonly label: string;
  readonly value: string;
  readonly error?: ReactNode;
  readonly onChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
  readonly selectOnOpen?: boolean;
};

const getDialogTitle = (t: Translator, dialogState: Exclude<KonquerorCommandDialogState, { kind: "closed" }>): string => {
  switch (dialogState.kind) {
    case "new-folder":
      return t("konqueror.context.newFolder");
    case "new-text-file":
      return t("konqueror.dialog.newTextFile");
    case "rename":
      return t("konqueror.menu.rename");
    default:
      return t("konqueror.dialog.command");
  }
};

const getDialogLabel = (t: Translator, dialogState: Exclude<KonquerorCommandDialogState, { kind: "closed" }>): string => {
  switch (dialogState.kind) {
    case "new-folder":
      return t("konqueror.dialog.folderName");
    case "new-text-file":
      return t("konqueror.dialog.fileName");
    case "rename":
      return t("konqueror.dialog.newName");
    default:
      return t("konqueror.dialog.name");
  }
};

export function KonquerorInputDialog({
  dialogState,
  onCancel,
  onChangeDraft,
  onSubmit,
}: KonquerorInputDialogProps) {
  const { t } = useI18n();
  if (dialogState.kind === "closed") {
    return null;
  }

  return (
    <KonquerorTextInputDialog
      title={getDialogTitle(t, dialogState)}
      label={getDialogLabel(t, dialogState)}
      value={dialogState.draftName}
      error={dialogState.error ? formatKonquerorMutationError(dialogState.error) : undefined}
      onChange={onChangeDraft}
      onCancel={onCancel}
      onSubmit={onSubmit}
      selectOnOpen={dialogState.kind === "rename"}
    />
  );
}

/** Shared KDE-style text dialog surface for Konqueror commands that own typed state elsewhere. */
export function KonquerorTextInputDialog({
  error,
  label,
  onCancel,
  onChange,
  onSubmit,
  selectOnOpen = false,
  title,
  value,
}: KonquerorTextInputDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (selectOnOpen) {
      inputRef.current?.select();
    }
  }, [selectOnOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="konqueror-dialog-backdrop" onKeyDown={handleKeyDown}>
      <section
        className="konqueror-input-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <form onSubmit={handleSubmit}>
          <h2 id={titleId}>{title}</h2>
          <label htmlFor={inputId}>{label}</label>
          <input
            ref={inputRef}
            id={inputId}
            className="konqueror-dialog-input"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          {error ? (
            <div className="konqueror-dialog-error" role="alert">
              {error}
            </div>
          ) : null}
          <div className="konqueror-dialog-actions">
            <button type="submit" className="kde-raised konqueror-dialog-button">
              {t("konqueror.dialog.ok")}
            </button>
            <button type="button" className="kde-raised konqueror-dialog-button" onClick={onCancel}>
              {t("konqueror.dialog.cancel")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
