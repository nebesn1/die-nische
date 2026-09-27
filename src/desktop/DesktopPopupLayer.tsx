import type { ReactNode } from "react";
import { useI18n } from "../i18n/useI18n";

type DesktopPopupLayerProps = {
  readonly children: ReactNode;
};

export function DesktopPopupLayer({ children }: DesktopPopupLayerProps) {
  const { t } = useI18n();
  return (
    <section className="desktop-popup-layer" aria-label={t("desktop.popups")}>
      {children}
    </section>
  );
}
