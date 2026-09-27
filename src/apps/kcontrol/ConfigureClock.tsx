import { useEffect, useRef, useState } from "react";
import type { ApplicationCloseRequest } from "../../application-runtime/types";
import {
  areDesktopPreferencesEqual,
  DEFAULT_DESKTOP_PREFERENCES,
} from "../../preferences/desktopPreferences";
import { useDesktopPreferences } from "../../preferences/useDesktopPreferences";
import {
  createKControlDraft,
  isKControlDraftDirty,
  shouldConfirmKControlClose,
  type KControlDraft,
} from "./controlCenterModel";
import { ClockSettings } from "./ClockSettings";
import { useI18n } from "../../i18n/useI18n";
import { getKControlPersistenceNoticeKey, type KControlNoticeKey } from "./kControlNotice";

type ConfigureClockDialog = { readonly type: "none" } | { readonly type: "confirm-close"; readonly closeRequestId: number };

type ConfigureClockProps = {
  readonly closeRequest?: ApplicationCloseRequest | null;
  readonly onCommitClose?: (requestId: number) => void;
  readonly onCancelClose?: (requestId: number) => void;
};

export function ConfigureClock({
  closeRequest = null,
  onCancelClose = () => undefined,
  onCommitClose = () => undefined,
}: ConfigureClockProps) {
  const { t } = useI18n();
  const { applyPreferences, persistenceStatus, preferences } = useDesktopPreferences();
  const [draft, setDraft] = useState<KControlDraft>(() => createKControlDraft(preferences));
  const [dialog, setDialog] = useState<ConfigureClockDialog>({ type: "none" });
  const [notice, setNotice] = useState<KControlNoticeKey | null>(null);
  const lastAppliedRef = useRef(preferences);
  const lastHandledCloseRequestIdRef = useRef<number | null>(null);
  const dirty = isKControlDraftDirty(draft, preferences);

  useEffect(() => {
    if (areDesktopPreferencesEqual(preferences, lastAppliedRef.current)) {
      return;
    }

    if (!isKControlDraftDirty(draft, lastAppliedRef.current)) {
      setDraft(createKControlDraft(preferences));
      setNotice(null);
    } else {
      setNotice("common.preferencesChangedExternally");
    }

    lastAppliedRef.current = preferences;
  }, [draft, preferences, t]);

  useEffect(() => {
    if (!closeRequest || closeRequest.requestId === lastHandledCloseRequestIdRef.current) {
      return;
    }

    lastHandledCloseRequestIdRef.current = closeRequest.requestId;
    if (!shouldConfirmKControlClose(draft, preferences)) {
      setDialog({ type: "none" });
      onCommitClose(closeRequest.requestId);
      return;
    }

    setDialog({ type: "confirm-close", closeRequestId: closeRequest.requestId });
  }, [closeRequest, draft, onCommitClose, preferences]);

  const applyDraft = () => {
    const result = applyPreferences(draft);
    lastAppliedRef.current = draft;
    setNotice(getKControlPersistenceNoticeKey(result) ?? "common.settingsApplied");
  };

  const noticeText = notice === null
    ? dirty
      ? t("common.modified")
      : (() => {
        const persistenceNotice = getKControlPersistenceNoticeKey(persistenceStatus);
        return persistenceNotice === null ? "" : t(persistenceNotice);
      })()
    : t(notice);

  const handleCloseApply = () => {
    if (dialog.type !== "confirm-close") return;
    applyDraft();
    setDialog({ type: "none" });
    onCommitClose(dialog.closeRequestId);
  };

  const handleCloseDiscard = () => {
    if (dialog.type !== "confirm-close") return;
    setDialog({ type: "none" });
    onCommitClose(dialog.closeRequestId);
  };

  const handleCloseCancel = () => {
    if (dialog.type !== "confirm-close") return;
    onCancelClose(dialog.closeRequestId);
    setDialog({ type: "none" });
  };

  return (
    <div className="kcontrol-app configure-clock-app" data-configure-clock-root="true">
      <main className="kcontrol-main configure-clock-main">
        <div className="kcontrol-content configure-clock-content">
          <ClockSettings draft={draft} onChange={(update) => setDraft(update)} />
        </div>
      </main>
      <footer className="kcontrol-actions">
        <span className="kcontrol-notice" aria-live="polite">
          {noticeText}
        </span>
        <button type="button" className="kde-raised" disabled={areDesktopPreferencesEqual(draft, DEFAULT_DESKTOP_PREFERENCES)} onClick={() => { setDraft(createKControlDraft(DEFAULT_DESKTOP_PREFERENCES)); setNotice(null); }}>{t("common.defaults")}</button>
        <button type="button" className="kde-raised" disabled={!dirty} onClick={() => { setDraft(createKControlDraft(preferences)); setNotice(null); }}>{t("common.reset")}</button>
        <button type="button" className="kde-raised" disabled={!dirty} onClick={applyDraft}>{t("common.apply")}</button>
      </footer>
      {dialog.type === "confirm-close" ? (
        <div className="kcontrol-dialog-backdrop">
          <section className="kcontrol-dialog" role="alertdialog" aria-modal="true" aria-label={t("controlCenter.configureClock")}>
            <h2>{t("controlCenter.configureClock")}</h2>
            <p>{t("controlCenter.applyBeforeClosing")}</p>
            <div className="kcontrol-dialog-actions">
              <button type="button" className="kde-raised" onClick={handleCloseApply}>{t("common.apply")}</button>
              <button type="button" className="kde-raised" onClick={handleCloseDiscard}>{t("common.discard")}</button>
              <button type="button" className="kde-raised" onClick={handleCloseCancel}>{t("common.cancel")}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
