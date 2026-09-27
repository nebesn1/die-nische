import { useState } from "react";
import { useI18n } from "../../i18n/useI18n";

type KonsoleRenameShellDialogProps = {
  readonly initialName: string;
  readonly onSave: (name: string) => boolean;
  readonly onCancel: () => void;
};

export function KonsoleRenameShellDialog({ initialName, onSave, onCancel }: KonsoleRenameShellDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [isInvalid, setIsInvalid] = useState(false);

  const save = () => {
    if (!onSave(name)) setIsInvalid(true);
  };

  return (
    <div className="konsole-rename-dialog" role="dialog" aria-modal="true" aria-label={t("konsole.renameShell")}>
      <label>
        <span>{t("konsole.shellName")}:</span>
        <input aria-label={t("konsole.shellName")} autoFocus value={name} maxLength={64} onChange={(event) => { setName(event.currentTarget.value); setIsInvalid(false); }} onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); save(); }
          if (event.key === "Escape") { event.preventDefault(); onCancel(); }
        }} />
      </label>
      {isInvalid ? <div className="konsole-rename-dialog__error" role="alert">{t("konsole.enterShellName")}</div> : null}
      <div className="konsole-rename-dialog__actions">
        <button type="button" className="kde-raised" onClick={save}>{t("common.ok")}</button>
        <button type="button" className="kde-raised" onClick={onCancel}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
