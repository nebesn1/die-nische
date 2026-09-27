import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DesktopTransientPopupContext,
  type DesktopTransientPopupContextValue,
  useDesktopTransientPopupLayer,
} from "./DesktopTransientPopupContext";
import { useI18n } from "../i18n/useI18n";

type DesktopTransientPopupProviderProps = {
  readonly children: ReactNode;
};

type DesktopTransientPopupLayerProps = {
  readonly children: ReactNode;
};

export function DesktopTransientPopupProvider({ children }: DesktopTransientPopupProviderProps) {
  const layerRef = useRef<HTMLElement | null>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const setLayerElement = useCallback((element: HTMLElement | null) => {
    layerRef.current = element;
    setLayer(element);
  }, []);
  const value = useMemo<DesktopTransientPopupContextValue>(
    () => ({ layerRef, layer, setLayerElement }),
    [layer, setLayerElement],
  );

  return <DesktopTransientPopupContext.Provider value={value}>{children}</DesktopTransientPopupContext.Provider>;
}

export function DesktopTransientPopupLayer({ children }: DesktopTransientPopupLayerProps) {
  const { t } = useI18n();
  const transientPopupLayer = useDesktopTransientPopupLayer();

  if (!transientPopupLayer) {
    throw new Error("DesktopTransientPopupLayer must be used inside DesktopTransientPopupProvider");
  }

  return (
    <section
      ref={transientPopupLayer.setLayerElement}
      className="desktop-transient-popup-layer"
      aria-label={t("desktop.transientPopups")}
    >
      {children}
    </section>
  );
}
