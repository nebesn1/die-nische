import type { VfsError } from "../../vfs/errors";
import { formatKonquerorFileOperationError, type KonquerorFileOperationErrorContext } from "./operationErrors";
import { translateKonquerorAvailabilityText } from "./konquerorI18n";
import { useI18n } from "../../i18n/useI18n";

type KonquerorOperationErrorViewProps = {
  readonly error: VfsError | null;
  readonly errorContext?: KonquerorFileOperationErrorContext | null;
  readonly message?: string | null;
};

export function KonquerorOperationErrorView({ error, errorContext = null, message = null }: KonquerorOperationErrorViewProps) {
  const { t } = useI18n();
  if (!error && !message) {
    return null;
  }

  return (
    <div className="konqueror-operation-error" role="status">
      <strong>{error ? t("konqueror.error.operation") : t("konqueror.error.requestBlocked")}</strong>{" "}
      {error ? formatKonquerorFileOperationError(error, errorContext ?? "clipboard", t) : message ? translateKonquerorAvailabilityText(t, message) : null}
    </div>
  );
}
