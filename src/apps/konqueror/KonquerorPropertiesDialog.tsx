import { useEffect, useRef, type KeyboardEvent } from "react";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import { deriveKonquerorFileProperties } from "./filePropertiesModel";
import { KonquerorNodeIcon } from "./icons";
import { useI18n } from "../../i18n/useI18n";
import { translateKonquerorNodeTypeLabel } from "./konquerorI18n";

type KonquerorPropertiesDialogProps = {
  readonly nodeId: VfsNodeId | null;
  readonly vfsState: VfsState;
  readonly onClose: () => void;
};

export function KonquerorPropertiesDialog({ nodeId, vfsState, onClose }: KonquerorPropertiesDialogProps) {
  const { t } = useI18n();
  const okButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (nodeId !== null) {
      okButtonRef.current?.focus();
    }
  }, [nodeId]);

  if (nodeId === null) {
    return null;
  }

  const result = deriveKonquerorFileProperties(vfsState, nodeId);
  const dialogTitle = result.type === "available" ? t("konqueror.dialog.propertiesFor", { name: result.properties.name }) : t("konqueror.dialog.properties");
  const dialogTitleId = "konqueror-properties-dialog-title";

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="konqueror-dialog-backdrop" onKeyDown={handleKeyDown}>
      <section
        className="konqueror-input-dialog konqueror-properties-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
      >
        <div className="konqueror-properties-dialog__body">
          <h2 id={dialogTitleId}>{dialogTitle}</h2>
          {result.type === "available" ? (
            <>
              <div className="konqueror-properties-dialog__identity">
                <KonquerorNodeIcon
                  className="konqueror-properties-dialog__icon"
                  iconId={result.properties.iconId}
                  aria-hidden="true"
                  focusable="false"
                />
                <strong>{result.properties.name}</strong>
              </div>
              <dl className="konqueror-properties-dialog__metadata">
                <dt>{t("konqueror.dialog.type")}</dt>
                <dd>{translateKonquerorNodeTypeLabel(t, result.properties.typeLabel)}</dd>
                <dt>{t("konqueror.dialog.location")}</dt>
                <dd>{result.properties.location}</dd>
                <dt>{t("konqueror.dialog.size")}</dt>
                <dd>{result.properties.sizeLabel}</dd>
                <dt>{t("konqueror.dialog.created")}</dt>
                <dd>{result.properties.createdLabel}</dd>
                <dt>{t("konqueror.dialog.modified")}</dt>
                <dd>{result.properties.modifiedLabel}</dd>
                {result.properties.target !== null ? <>
                  <dt>{t("konqueror.dialog.target")}</dt>
                  <dd>{result.properties.target}</dd>
                </> : null}
                <dt>{t("konqueror.dialog.fullPath")}</dt>
                <dd>{result.properties.fullPath}</dd>
              </dl>
            </>
          ) : (
            <p className="konqueror-properties-dialog__unavailable">{t("konqueror.dialog.thisItemUnavailable")}</p>
          )}
          <div className="konqueror-dialog-actions">
            <button ref={okButtonRef} type="button" className="kde-raised konqueror-dialog-button" onClick={onClose}>
              {t("konqueror.dialog.ok")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
