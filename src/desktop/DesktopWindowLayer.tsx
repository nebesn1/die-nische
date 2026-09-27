import { ApplicationHost } from "../application-runtime/ApplicationHost";
import { WindowIcon } from "../icons/windowIconRegistry";
import { WindowFrame } from "../window-manager/WindowFrame";
import { useWindowManager } from "../window-manager/useWindowManager";
import { getWindowShellIconId } from "../window-manager/windowShellIcon";
import { WindowOwnedPopupLayer } from "./WindowOwnedPopupLayer";
import { useI18n } from "../i18n/useI18n";

export function DesktopWindowLayer() {
  const { t } = useI18n();
  const { launcherMetadataByWindowId = {}, windows } = useWindowManager();

  return (
    <section className="desktop-window-layer" aria-label={t("desktop.applicationWindows")}>
      {windows.map((desktopWindow) => (
        <WindowOwnedPopupLayer key={desktopWindow.id} desktopWindow={desktopWindow}>
          <WindowFrame
            desktopWindow={desktopWindow}
            className={`application-window application-window--${desktopWindow.appId}`}
            icon={
              <WindowIcon
                iconId={getWindowShellIconId(desktopWindow, launcherMetadataByWindowId)}
                aria-hidden="true"
                focusable="false"
              />
            }
          >
            <ApplicationHost desktopWindow={desktopWindow} />
          </WindowFrame>
        </WindowOwnedPopupLayer>
      ))}
    </section>
  );
}
