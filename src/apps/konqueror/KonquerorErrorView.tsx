import type { VfsError } from "../../vfs/errors";
import { formatKonquerorNavigationError } from "./navigationController";
import { useI18n } from "../../i18n/useI18n";

type KonquerorErrorViewProps = {
  readonly error: VfsError | null;
};

export function KonquerorErrorView({ error }: KonquerorErrorViewProps) {
  const { t } = useI18n();
  if (!error) {
    return null;
  }

  return (
    <div className="konqueror-error-view" role="status">
      <strong>{t("konqueror.error.location")}</strong> {formatKonquerorNavigationError(error)}
    </div>
  );
}
