import { useEffect, useRef, type KeyboardEvent } from "react";
import { SecurityIcon } from "./icons";
import type { KonquerorSecurityInfo } from "./securityInfo";
import { useI18n } from "../../i18n/useI18n";

type KonquerorSecurityDialogProps = {
  readonly securityInfo: KonquerorSecurityInfo | null;
  readonly onClose: () => void;
};

export function KonquerorSecurityDialog({ securityInfo, onClose }: KonquerorSecurityDialogProps) {
  const { t } = useI18n();
  const okButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (securityInfo !== null) {
      okButtonRef.current?.focus();
    }
  }, [securityInfo]);

  if (securityInfo === null) {
    return null;
  }

  const isExternalHttps = securityInfo.kind === "external-https";
  const summary = isExternalHttps
    ? t("konqueror.security.httpsRequested")
    : t("konqueror.security.notSecured");
  const typeLabel = securityInfo.kind === "internal"
    ? t("konqueror.security.internalPage")
    : securityInfo.kind === "local-file"
    ? t("konqueror.security.localFile")
    : null;
  const loadStatus = securityInfo.kind === "external-https"
    ? securityInfo.loadStatus === "Page loaded"
      ? t("konqueror.security.pageLoaded")
      : securityInfo.loadStatus === "Loading stopped"
      ? t("konqueror.security.loadingStopped")
      : t("konqueror.security.loading")
    : null;
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
        className="konqueror-input-dialog konqueror-security-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="konqueror-security-dialog-title"
      >
        <header className="konqueror-security-dialog__titlebar">
          <h2 id="konqueror-security-dialog-title">{t("konqueror.security.title")}</h2>
          <button type="button" className="konqueror-security-dialog__close" aria-label={t("konqueror.security.close")} title={t("common.close")} onClick={onClose}>X</button>
        </header>
        <div className="konqueror-security-dialog__body">
          <div className="konqueror-security-dialog__summary">
            {isExternalHttps ? <SecurityIcon aria-hidden="true" focusable="false" /> : null}
            <p>{summary}</p>
          </div>
          <section className="konqueror-security-dialog__group" aria-label={t("konqueror.security.connection")}>
            <h3>{t("konqueror.security.connection")}</h3>
            <dl>
              <dt>{t("konqueror.location.label")}</dt>
              <dd>{securityInfo.location}</dd>
              {isExternalHttps ? (
                <>
                  <dt>{t("konqueror.security.protocol")}</dt>
                  <dd>{securityInfo.protocol}</dd>
                  <dt>{t("konqueror.security.host")}</dt>
                  <dd>{securityInfo.host}</dd>
                  <dt>{t("konqueror.security.port")}</dt>
                  <dd>{securityInfo.port}</dd>
                  <dt>{t("konqueror.security.loadStatus")}</dt>
                  <dd>{loadStatus}</dd>
                </>
              ) : (
                <>
                  <dt>{t("konqueror.dialog.type")}</dt>
                  <dd>{typeLabel}</dd>
                </>
              )}
            </dl>
          </section>
          {isExternalHttps ? (
            <section className="konqueror-security-dialog__group" aria-label={t("konqueror.security.certificate")}>
              <h3>{t("konqueror.security.certificate")}</h3>
              <p>{t("konqueror.security.detailsUnavailable")}</p>
            </section>
          ) : null}
          <div className="konqueror-dialog-actions">
          <button ref={okButtonRef} type="button" className="kde-raised konqueror-dialog-button" onClick={onClose}>{t("common.ok")}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
