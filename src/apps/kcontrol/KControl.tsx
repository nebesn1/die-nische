import { useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import type { ApplicationCloseRequest, ApplicationLaunchRequest } from "../../application-runtime/types";
import { useApplicationMenuDismissal } from "../useApplicationMenuDismissal";
import {
  DEFAULT_DESKTOP_PREFERENCES,
  DEFAULT_DESKTOP_COUNT,
  MAX_DESKTOP_COUNT,
  areDesktopPreferencesEqual,
  desktopBackgroundPresets,
  type DesktopBackgroundPreset,
} from "../../preferences/desktopPreferences";
import { useDesktopPreferences } from "../../preferences/useDesktopPreferences";
import {
  createKControlDraft,
  isKControlDraftDirty,
  parseKControlDesktopCountDraft,
  setKControlBackground,
  setKControlDesktopCount,
  setKControlDesktopIcons,
  setKControlLocale,
  setKControlTheme,
  getKControlWindowTitleKey,
  shouldConfirmKControlClose,
  initialControlCenterExpandedCategories,
  type KControlTreeExpansionRequest,
  type KControlPage,
} from "./controlCenterModel";
import { themeCatalog } from "../../theme/themeCatalog";
import { KControlTree } from "./KControlTree";
import {
  getKControlExpandedCategoriesForModule,
  getKControlPageForModule,
  isControlCenterOpenIntent,
} from "./controlCenterLaunchIntent";
import { desktopLocaleOptions } from "../../i18n/locale";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/messages/en";
import { getKControlPersistenceNoticeKey, type KControlNoticeKey } from "./kControlNotice";
import { APPLICATION_MENUBAR_CLASS, useApplicationMenubarPolicy } from "../applicationMenubarPolicy";

type KControlDialog =
  | { readonly type: "none" }
  | { readonly type: "confirm-close"; readonly closeRequestId: number }
  | {
    readonly type: "confirm-module-switch";
    readonly targetPage: KControlPage;
    readonly expansionRequest?: KControlTreeExpansionRequest;
  };
type KControlMenu = "file" | "help" | null;

type KControlProps = {
  readonly launchRequest?: ApplicationLaunchRequest | null;
  readonly closeRequest?: ApplicationCloseRequest | null;
  readonly onRequestClose?: () => void;
  readonly onCommitClose?: (requestId: number) => void;
  readonly onCancelClose?: (requestId: number) => void;
  readonly onSetWindowTitle?: (title: string) => void;
};

const backgroundLabelKeys: Readonly<Record<DesktopBackgroundPreset, TranslationKey>> = {
  "kde-classic": "controlCenter.kdeClassic",
  "deep-blue": "controlCenter.deepBlue",
  teal: "controlCenter.teal",
  slate: "controlCenter.slate",
  black: "controlCenter.black",
};

export function KControl({
  closeRequest = null,
  launchRequest = null,
  onCancelClose = () => undefined,
  onCommitClose = () => undefined,
  onRequestClose = () => undefined,
  onSetWindowTitle = () => undefined,
}: KControlProps) {
  const launcher = useContext(ApplicationLauncherContext);
  const { t } = useI18n();
  const { applyPreferences, persistenceStatus, preferences } = useDesktopPreferences();
  const controlCenterLaunchIntent = launchRequest && isControlCenterOpenIntent(launchRequest.intent)
    ? launchRequest.intent
    : null;
  const initialExpandedCategories = controlCenterLaunchIntent === null
    ? initialControlCenterExpandedCategories
    : getKControlExpandedCategoriesForModule(controlCenterLaunchIntent.module);
  const [draft, setDraft] = useState(() => createKControlDraft(preferences));
  const [desktopCountText, setDesktopCountText] = useState(() => String(createKControlDraft(preferences).desktopCount ?? DEFAULT_DESKTOP_COUNT));
  const [page, setPage] = useState<KControlPage | null>(null);
  const [dialog, setDialog] = useState<KControlDialog>({ type: "none" });
  const [treeExpansionRequest, setTreeExpansionRequest] = useState<KControlTreeExpansionRequest | null>(null);
  const [openMenu, setOpenMenu] = useState<KControlMenu>(null);
  const closeApplicationMenu = useCallback(() => setOpenMenu(null), []);
  const menuBarRef = useRef<HTMLElement | null>(null);
  const [notice, setNotice] = useState<KControlNoticeKey | null>(null);
  const lastAppliedRef = useRef(preferences);
  const lastHandledCloseRequestIdRef = useRef<number | null>(null);
  const lastHandledLaunchRequestIdRef = useRef<number | null>(null);
  const dirty = isKControlDraftDirty(draft, preferences);
  const desktopCountDraftValue = parseKControlDesktopCountDraft(desktopCountText);
  const desktopCountDraftValid = desktopCountDraftValue !== null;
  const desktopCountDraftNeedsRecovery = page === "multiple-desktops" && !desktopCountDraftValid;

  const requestPage = useCallback((nextPage: KControlPage, expansionRequest?: KControlTreeExpansionRequest) => {
    if (page === nextPage) {
      if (expansionRequest) {
        setTreeExpansionRequest(expansionRequest);
      }
      return;
    }

    if (dirty) {
      setDialog({ type: "confirm-module-switch", targetPage: nextPage, expansionRequest });
      return;
    }

    if (expansionRequest) {
      setTreeExpansionRequest(expansionRequest);
    }
    setPage(nextPage);
  }, [dirty, page]);

  useApplicationMenuDismissal({
    isOpen: openMenu !== null,
    menuBarRef,
    onDismiss: () => setOpenMenu(null),
  });
  useApplicationMenubarPolicy(closeApplicationMenu);

  useEffect(() => {
    onSetWindowTitle(t(getKControlWindowTitleKey(page)) + (page === null ? "" : ` - ${t("controlCenter.title")}`));
  }, [onSetWindowTitle, page, t]);

  useEffect(() => {
    if (areDesktopPreferencesEqual(preferences, lastAppliedRef.current)) {
      return;
    }

    if (!isKControlDraftDirty(draft, lastAppliedRef.current)) {
      const nextDraft = createKControlDraft(preferences);
      setDraft(nextDraft);
      setDesktopCountText(String(nextDraft.desktopCount ?? DEFAULT_DESKTOP_COUNT));
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
    setOpenMenu(null);

    if (!shouldConfirmKControlClose(draft, preferences)) {
      setDialog({ type: "none" });
      onCommitClose(closeRequest.requestId);
      return;
    }

    setDialog({ type: "confirm-close", closeRequestId: closeRequest.requestId });
  }, [closeRequest, draft, onCommitClose, preferences]);

  useEffect(() => {
    if (!launchRequest || launchRequest.requestId === lastHandledLaunchRequestIdRef.current || !isControlCenterOpenIntent(launchRequest.intent)) {
      return;
    }

    lastHandledLaunchRequestIdRef.current = launchRequest.requestId;
    requestPage(getKControlPageForModule(launchRequest.intent.module), {
      requestId: launchRequest.requestId,
      expandedCategories: getKControlExpandedCategoriesForModule(launchRequest.intent.module),
    });
  }, [launchRequest, requestPage]);

  const applyDraft = () => {
    if (!desktopCountDraftValid) {
      return;
    }

    const result = applyPreferences(draft);
    lastAppliedRef.current = draft;
    setNotice(getKControlPersistenceNoticeKey(result) ?? "common.settingsApplied");
  };

  const handleCloseApply = () => {
    if (dialog.type !== "confirm-close") {
      return;
    }

    applyDraft();
    setDialog({ type: "none" });
    onCommitClose(dialog.closeRequestId);
  };

  const handleCloseDiscard = () => {
    if (dialog.type !== "confirm-close") {
      return;
    }

    setDialog({ type: "none" });
    onCommitClose(dialog.closeRequestId);
  };

  const handleCloseCancel = () => {
    if (dialog.type !== "confirm-close") {
      return;
    }

    onCancelClose(dialog.closeRequestId);
    setDialog({ type: "none" });
  };

  const handleModuleSwitchApply = () => {
    if (dialog.type !== "confirm-module-switch") {
      return;
    }

    applyDraft();
    if (dialog.expansionRequest) {
      setTreeExpansionRequest(dialog.expansionRequest);
    }
    setDialog({ type: "none" });
    setPage(dialog.targetPage);
  };

  const handleModuleSwitchDiscard = () => {
    if (dialog.type !== "confirm-module-switch") {
      return;
    }

    const nextDraft = createKControlDraft(preferences);
    setDraft(nextDraft);
    setDesktopCountText(String(nextDraft.desktopCount ?? DEFAULT_DESKTOP_COUNT));
    setNotice(null);
    if (dialog.expansionRequest) {
      setTreeExpansionRequest(dialog.expansionRequest);
    }
    setDialog({ type: "none" });
    setPage(dialog.targetPage);
  };

  const handleModuleSwitchCancel = () => {
    if (dialog.type === "confirm-module-switch") {
      setDialog({ type: "none" });
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (dialog.type === "none" && openMenu !== null && event.key === "Escape") {
      event.preventDefault();
      setOpenMenu(null);
    }
  };

  const noticeText = notice === null
    ? dirty
      ? t("common.modified")
      : (() => {
        const persistenceNotice = getKControlPersistenceNoticeKey(persistenceStatus);
        return persistenceNotice === null ? "" : t(persistenceNotice);
      })()
    : t(notice);

  const renderPage = () => {
    if (page === null) {
      return (
        <section className="kcontrol-home" aria-labelledby="kcontrol-home-title">
          <h1 id="kcontrol-home-title">{t("controlCenter.kdeTitle")}</h1>
          <p className="kcontrol-home__subtitle">{t("controlCenter.homeSubtitle")}</p>
          <p>{t("controlCenter.homeIntro")}</p>
          <p>{t("controlCenter.selectModule")}</p>
          <dl className="kcontrol-home__info">
            <div><dt>{t("controlCenter.kdeVersion")}</dt><dd>3</dd></div>
            <div><dt>{t("controlCenter.user")}</dt><dd>user</dd></div>
            <div><dt>{t("controlCenter.environment")}</dt><dd>{t("controlCenter.webDesktop")}</dd></div>
            <div><dt>{t("controlCenter.runtime")}</dt><dd>{t("controlCenter.webBrowser")}</dd></div>
          </dl>
        </section>
      );
    }

    if (page === "background") {
      return (
        <section className="kcontrol-page" aria-labelledby="kcontrol-page-title">
          <h2 id="kcontrol-page-title">{t("controlCenter.background")}</h2>
          <div className={`kcontrol-background-preview kcontrol-background-preview--${draft.backgroundPreset}`} aria-label={`${t(backgroundLabelKeys[draft.backgroundPreset])} ${t("controlCenter.desktopBackgroundPreview")}`} />
          <div className="kcontrol-setting-group" role="group" aria-label={t("controlCenter.background")}>
            <span className="kcontrol-setting-label">{t("controlCenter.backgroundPreset")}</span>
            <div className="kcontrol-preset-list">
              {desktopBackgroundPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`kcontrol-preset${draft.backgroundPreset === preset ? " is-selected" : ""}`}
                  aria-pressed={draft.backgroundPreset === preset}
                  onClick={() => setDraft((current) => setKControlBackground(current, preset))}
                >
                  <span className={`kcontrol-preset__swatch kcontrol-preset__swatch--${preset}`} aria-hidden="true" />
                  {t(backgroundLabelKeys[preset])}
                </button>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (page === "icons") {
      return (
        <section className="kcontrol-page" aria-labelledby="kcontrol-page-title">
          <h2 id="kcontrol-page-title">{t("controlCenter.behavior")}</h2>
          <label className="kcontrol-checkbox">
            <input
              type="checkbox"
              checked={draft.showDesktopIcons}
              onChange={(event) => {
                const showDesktopIcons = event.currentTarget.checked;
                setDraft((current) => setKControlDesktopIcons(current, showDesktopIcons));
              }}
            />
            {t("controlCenter.showDesktopIcons")}
          </label>
        </section>
      );
    }

    if (page === "theme-manager") {
      return (
        <section className="kcontrol-page kcontrol-theme-manager" aria-labelledby="kcontrol-page-title">
          <h2 id="kcontrol-page-title">{t("controlCenter.themeManager")}</h2>
          <div className="kcontrol-theme-list" role="radiogroup" aria-label={t("controlCenter.desktopTheme")}>
            {themeCatalog.map((theme) => (
              <label key={theme.id} className={`kcontrol-theme-option${draft.themeId === theme.id ? " is-selected" : ""}`}>
                <input
                  type="radio"
                  name="kcontrol-theme"
                  value={theme.id}
                  checked={draft.themeId === theme.id}
                  onChange={() => setDraft((current) => setKControlTheme(current, theme.id))}
                />
                <span>{theme.label}</span>
              </label>
            ))}
          </div>
        </section>
      );
    }

    if (page === "multiple-desktops") {
      return (
        <section className="kcontrol-page" aria-labelledby="kcontrol-page-title">
          <h2 id="kcontrol-page-title">{t("controlCenter.multipleDesktops")}</h2>
          <label className="kcontrol-setting-group">
            <span className="kcontrol-setting-label">{t("controlCenter.numberOfDesktops")}</span>
            <input
              type="number"
              min={1}
              max={MAX_DESKTOP_COUNT}
              step={1}
              value={desktopCountText}
              onChange={(event) => {
                const nextText = event.currentTarget.value;
                const desktopCount = parseKControlDesktopCountDraft(nextText);
                setDesktopCountText(nextText);

                if (desktopCount !== null) {
                  setDraft((current) => setKControlDesktopCount(current, desktopCount));
                }
              }}
            />
          </label>
        </section>
      );
    }

    if (page === "language") {
      return (
        <section className="kcontrol-page" aria-labelledby="kcontrol-page-title">
          <h2 id="kcontrol-page-title">{t("controlCenter.countryRegionLanguage")}</h2>
          <fieldset className="kcontrol-language-options">
            <legend>{t("common.language")}</legend>
            {desktopLocaleOptions.map((option) => (
              <label key={option.id} className="kcontrol-language-option">
                <input
                  type="radio"
                  name="kcontrol-locale"
                  value={option.id}
                  checked={draft.locale === option.id}
                  onChange={() => setDraft((current) => setKControlLocale(current, option.id))}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="kcontrol-app" data-kcontrol-root="true" onKeyDownCapture={handleKeyDown}>
      <nav ref={menuBarRef} className={`${APPLICATION_MENUBAR_CLASS} konqueror-menubar kde-chrome-surface kcontrol-menubar`} aria-label={t("controlCenter.kdeTitle")}>
        <div className="konqueror-application-menu-root kcontrol-menu-root">
          <button type="button" className={`konqueror-menuitem kcontrol-menuitem${openMenu === "file" ? " is-active" : ""}`} aria-haspopup="menu" aria-expanded={openMenu === "file"} onClick={() => setOpenMenu((current) => current === "file" ? null : "file")}>{t("controlCenter.file")}</button>
          {openMenu === "file" ? (
            <div className="konqueror-menu-popup kcontrol-menu-popup" role="menu" aria-label={t("controlCenter.fileMenu")}>
              <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); onRequestClose(); }}>{t("controlCenter.quit")}</button>
            </div>
          ) : null}
        </div>
        <div className="konqueror-application-menu-root kcontrol-menu-root">
          <button type="button" className={`konqueror-menuitem kcontrol-menuitem${openMenu === "help" ? " is-active" : ""}`} aria-haspopup="menu" aria-expanded={openMenu === "help"} onClick={() => setOpenMenu((current) => current === "help" ? null : "help")}>{t("controlCenter.help")}</button>
          {openMenu === "help" ? (
            <div className="konqueror-menu-popup kcontrol-menu-popup" role="menu" aria-label={t("controlCenter.helpMenu")}>
              <button type="button" role="menuitem" onClick={() => { launcher?.launchApplication("about-kcontrol"); setOpenMenu(null); }}>{t("controlCenter.aboutControlCenter")}</button>
              <button type="button" role="menuitem" onClick={() => { launcher?.launchApplication("about-kde"); setOpenMenu(null); }}>{t("controlCenter.aboutKde")}</button>
            </div>
          ) : null}
        </div>
      </nav>
      <main className="kcontrol-main" aria-hidden={dialog.type !== "none"}>
        <aside className="kcontrol-navigation" aria-label={t("controlCenter.title")}>
          <KControlTree
            selectedPage={page}
            onSelectPage={requestPage}
            initialExpandedCategories={initialExpandedCategories}
            expansionRequest={treeExpansionRequest}
          />
        </aside>
        <div className="kcontrol-content">{renderPage()}</div>
      </main>
      <footer className="kcontrol-actions">
        <span className="kcontrol-notice" aria-live="polite">{noticeText}</span>
        <button type="button" className="kde-raised" disabled={page === null || (!desktopCountDraftNeedsRecovery && areDesktopPreferencesEqual(draft, DEFAULT_DESKTOP_PREFERENCES))} onClick={() => { const nextDraft = createKControlDraft(DEFAULT_DESKTOP_PREFERENCES); setDraft(nextDraft); setDesktopCountText(String(nextDraft.desktopCount ?? DEFAULT_DESKTOP_COUNT)); setNotice(null); }}>{t("common.defaults")}</button>
        <button type="button" className="kde-raised" disabled={page === null || (!desktopCountDraftNeedsRecovery && !dirty)} onClick={() => { const nextDraft = createKControlDraft(preferences); setDraft(nextDraft); setDesktopCountText(String(nextDraft.desktopCount ?? DEFAULT_DESKTOP_COUNT)); setNotice(null); }}>{t("common.reset")}</button>
        <button type="button" className="kde-raised" disabled={page === null || !dirty || !desktopCountDraftValid} onClick={applyDraft}>{t("common.apply")}</button>
      </footer>
      {dialog.type === "confirm-close" ? (
        <div className="kcontrol-dialog-backdrop">
          <section className="kcontrol-dialog" role="alertdialog" aria-modal="true" aria-label={t("controlCenter.kdeTitle")}>
            <h2>{t("controlCenter.kdeTitle")}</h2>
            <p>{t("controlCenter.applyBeforeClosing")}</p>
            <div className="kcontrol-dialog-actions">
              <button type="button" className="kde-raised" disabled={!desktopCountDraftValid} onClick={handleCloseApply}>{t("common.apply")}</button>
              <button type="button" className="kde-raised" onClick={handleCloseDiscard}>{t("common.discard")}</button>
              <button type="button" className="kde-raised" onClick={handleCloseCancel}>{t("common.cancel")}</button>
            </div>
          </section>
        </div>
      ) : null}
      {dialog.type === "confirm-module-switch" ? (
        <div className="kcontrol-dialog-backdrop">
          <section className="kcontrol-dialog" role="alertdialog" aria-modal="true" aria-label={t("controlCenter.kdeTitle")}>
            <h2>{t("controlCenter.kdeTitle")}</h2>
            <p>{t("controlCenter.applyBeforeSwitching")}</p>
            <div className="kcontrol-dialog-actions">
              <button type="button" className="kde-raised" disabled={!desktopCountDraftValid} onClick={handleModuleSwitchApply}>{t("common.apply")}</button>
              <button type="button" className="kde-raised" onClick={handleModuleSwitchDiscard}>{t("common.discard")}</button>
              <button type="button" className="kde-raised" onClick={handleModuleSwitchCancel}>{t("common.cancel")}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
