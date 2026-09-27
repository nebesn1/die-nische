import { useEffect, useRef } from "react";
import { ClipboardIcon } from "../icons/IconComponents";
import { useApplicationMenuDismissal } from "../apps/useApplicationMenuDismissal";
import { useOptionalResponsiveLayout } from "../desktop/responsiveLayoutContext";
import { useDesktopSession } from "../desktop/useDesktopSession";
import { useI18n } from "../i18n/useI18n";

export function ClipboardApplet() {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const responsiveLayout = useOptionalResponsiveLayout();
  const {
    clipboardHistory,
    clipboardStatus,
    clearClipboardHistory,
    closeClipboard,
    isClipboardOpen,
    toggleClipboard,
    writeClipboard,
  } = useDesktopSession();

  useEffect(() => {
    if (responsiveLayout?.layoutMode === "mobile" && isClipboardOpen) {
      closeClipboard();
    }
  }, [closeClipboard, isClipboardOpen, responsiveLayout?.layoutMode]);

  useApplicationMenuDismissal({ isOpen: isClipboardOpen, menuBarRef: rootRef, onDismiss: closeClipboard });

  return (
    <div ref={rootRef} className="clipboard-applet" data-klipper-ignore-selection>
      <button
        type="button"
        className={`kicker-launcher kicker-utility-button kicker-utility-button--clipboard${isClipboardOpen ? " is-active" : ""}`}
        aria-label={isClipboardOpen ? t("kicker.closeClipboard") : t("kicker.openClipboard")}
        aria-expanded={isClipboardOpen}
        title={t("kicker.klipperTool")}
        onClick={toggleClipboard}
      >
        <ClipboardIcon aria-hidden="true" focusable="false" />
      </button>
      {isClipboardOpen ? (
        <section className="clipboard-popup" role="dialog" aria-label={t("kicker.klipperTool")}>
          <strong>{t("kicker.klipperTool")}</strong>
          {clipboardHistory.length > 0 ? (
            <ol className="clipboard-popup__history">
              {clipboardHistory.map((text, index) => (
                <li key={`${index}-${text}`}>
                  <button type="button" title={text} onClick={() => void writeClipboard(text)}>{text}</button>
                </li>
              ))}
            </ol>
          ) : <p className="clipboard-popup__empty">{t("kicker.clipboardEmpty")}</p>}
          {clipboardStatus ? <p className="clipboard-popup__status" role="status">{clipboardStatus === "Copied to clipboard." ? t("kicker.clipboardCopied") : clipboardStatus === "Clipboard write was denied." ? t("kicker.clipboardDenied") : clipboardStatus}</p> : null}
          <button
            type="button"
            className="clipboard-popup__clear"
            disabled={clipboardHistory.length === 0}
            onClick={clearClipboardHistory}
          >
            {t("kicker.clearClipboard")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
