import { useI18n } from "../../i18n/useI18n";

type KonquerorUnsavedIndicatorProps = {
  readonly isDirty: boolean;
};

export function KonquerorUnsavedIndicator({ isDirty }: KonquerorUnsavedIndicatorProps) {
  const { t } = useI18n();
  if (!isDirty) {
    return <span className="konqueror-unsaved-indicator">{t("konqueror.status.editing")}</span>;
  }

  return <span className="konqueror-unsaved-indicator is-dirty">{t("konqueror.status.unsaved")}</span>;
}
