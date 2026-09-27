import { useEffect, useRef } from "react";
import { useI18n } from "../../i18n/useI18n";

type RunCommandDialogProps = {
  readonly value: string;
  readonly error: string | null;
  readonly onChange: (value: string) => void;
  readonly onRun: () => void;
  readonly onCancel: () => void;
  readonly onDismissError: () => void;
};

export function RunCommandDialog({ value, error, onCancel, onChange, onDismissError, onRun }: RunCommandDialogProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const errorButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      errorButtonRef.current?.focus();
    }
  }, [error]);

  return (
    <section className="run-command-overlay" role="dialog" aria-modal="true" aria-label={t("runCommand.title")} onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }}>
      <section className="run-command-window">
        <header className="run-command-window__titlebar">{t("runCommand.title")}</header>
        <form className="run-command-dialog" onSubmit={(event) => {
          event.preventDefault();
          onRun();
        }}>
          <label htmlFor="run-command-input">{t("runCommand.command")}</label>
          <input
            ref={inputRef}
            id="run-command-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <div className="run-command-dialog__actions">
            <button type="submit" className="kde-raised">{t("common.run")}</button>
            <button type="button" className="kde-raised" onClick={onCancel}>{t("common.cancel")}</button>
          </div>
        </form>
      </section>
      {error ? (
        <section className="run-command-error-dialog" role="alertdialog" aria-modal="true" aria-label={t("runCommand.error")}>
          <p>{error}</p>
          <button ref={errorButtonRef} type="button" className="kde-raised" onClick={onDismissError}>{t("common.ok")}</button>
        </section>
      ) : null}
    </section>
  );
}
