import { useEffect, useRef } from "react";
import { KMenuIcon } from "../icons/IconComponents";
import { useDesktopSession } from "./useDesktopSession";
import { useI18n } from "../i18n/useI18n";

export function DesktopSessionOverlay() {
  const { t } = useI18n();
  const { closeEndSession, confirmEndSession, endSessionDialog, isLocked, requestEndSession, returnToEndSessionOptions, unlockSession } = useDesktopSession();
  const unlockRef = useRef<HTMLButtonElement | null>(null);
  const endSessionPrimaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isLocked) {
      unlockRef.current?.focus();
    }
  }, [isLocked]);

  useEffect(() => {
    if (endSessionDialog !== "closed") {
      endSessionPrimaryRef.current?.focus();
    }
  }, [endSessionDialog]);

  if (isLocked) {
    return (
      <section className="session-lock-overlay" role="dialog" aria-modal="true" aria-label={t("session.locked")} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
        }
      }}>
        <div className="session-lock-overlay__panel">
          <KMenuIcon aria-hidden="true" focusable="false" />
          <strong>{t("desktop.shell")}</strong>
          <p>{t("session.locked")}</p>
          <button ref={unlockRef} type="button" className="kde-raised" onClick={unlockSession}>{t("session.unlock")}</button>
        </div>
      </section>
    );
  }

  if (endSessionDialog === "closed") {
    return null;
  }

  const isConfirming = endSessionDialog === "confirm";
  const isLogout = endSessionDialog === "logout";
  return (
    <section className="session-end-overlay" role="dialog" aria-modal="true" aria-label={t("session.end")} onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (isConfirming) {
          returnToEndSessionOptions();
        } else {
          closeEndSession();
        }
      }
    }}>
      <div className="session-end-dialog">
        <div className="session-end-dialog__branding"><KMenuIcon aria-hidden="true" focusable="false" /></div>
        <div className="session-end-dialog__content">
          <h2>{t("session.endFor", { name: isLogout ? "user" : t("desktop.shell") })}</h2>
          {isLogout ? null : isConfirming ? <p>{t("session.confirmEnd")}</p> : <p>{t("session.chooseAction")}</p>}
          {isLogout ? (
            <div className="session-end-dialog__actions">
              <button ref={endSessionPrimaryRef} type="button" className="kde-raised" onClick={confirmEndSession}>{t("session.logout")}</button>
              <button type="button" className="kde-raised" onClick={closeEndSession}>{t("common.cancel")}</button>
            </div>
          ) : isConfirming ? (
            <div className="session-end-dialog__actions">
              <button ref={endSessionPrimaryRef} type="button" className="kde-raised" onClick={confirmEndSession}>{t("session.end")}</button>
              <button type="button" className="kde-raised" onClick={closeEndSession}>{t("common.cancel")}</button>
            </div>
          ) : (
            <div className="session-end-dialog__actions">
              <button ref={endSessionPrimaryRef} type="button" className="kde-raised" onClick={requestEndSession}>{t("session.endCurrent")}</button>
              <button type="button" className="kde-raised" disabled title={t("session.unavailable")}>{t("session.turnOff")}</button>
              <button type="button" className="kde-raised" disabled title={t("session.unavailable")}>{t("session.restart")}</button>
              <button type="button" className="kde-raised" disabled title={t("session.unavailable")}>{t("session.suspend")}</button>
              <button type="button" className="kde-raised" onClick={closeEndSession}>{t("common.cancel")}</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
