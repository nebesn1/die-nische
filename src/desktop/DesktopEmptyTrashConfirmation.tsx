import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/useI18n";

type DesktopEmptyTrashConfirmationProps = {
  readonly isOpen: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

export function DesktopEmptyTrashConfirmation({ isOpen, onCancel, onConfirm }: DesktopEmptyTrashConfirmationProps) {
  const { t } = useI18n();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return <section className="desktop-empty-trash-backdrop" role="presentation"><div className="desktop-empty-trash-dialog" role="dialog" aria-modal="true" aria-label={t("desktop.emptyTrashQuestion")} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onCancel(); } }}><h2>{t("desktop.emptyTrashQuestion")}</h2><p>{t("desktop.emptyTrashDescription")}</p><div className="desktop-empty-trash-dialog__actions"><button ref={confirmRef} type="button" className="kde-raised" onClick={onConfirm}>{t("desktop.emptyTrash")}</button><button type="button" className="kde-raised" onClick={onCancel}>{t("common.cancel")}</button></div></div></section>;
}
