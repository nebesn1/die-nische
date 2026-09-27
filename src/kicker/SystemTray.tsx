import { TrayLockIcon, TrayNetworkIcon } from "../icons/IconComponents";
import { useI18n } from "../i18n/useI18n";

export function SystemTray() {
  const { t } = useI18n();
  return (
    <div className="system-tray" aria-label={t("kicker.systemTray")}>
      <span className="tray-icon" aria-hidden="true">
        <TrayNetworkIcon aria-hidden="true" focusable="false" />
      </span>
      <span className="tray-icon" aria-hidden="true">
        <TrayLockIcon aria-hidden="true" focusable="false" />
      </span>
    </div>
  );
}
