import { WindowMenu } from "../window-manager/window-menu/WindowMenu";
import { useI18n } from "../i18n/useI18n";

export function WindowPopupLayer() {
  const { t } = useI18n();
  return (
    <section className="window-popup-layer" aria-label={t("desktop.windows")}>
      <WindowMenu />
    </section>
  );
}
