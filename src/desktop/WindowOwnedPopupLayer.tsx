import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DesktopWindow } from "../window-manager/types";
import { useWindowManager } from "../window-manager/useWindowManager";
import { useDesktopTransientPopupLayer } from "./DesktopTransientPopupContext";
import { WindowOwnedPopupContext, type WindowOwnedPopupContextValue } from "./WindowOwnedPopupContext";
import { useI18n } from "../i18n/useI18n";

type WindowOwnedPopupLayerProps = {
  readonly desktopWindow: DesktopWindow;
  readonly children: ReactNode;
};

export function WindowOwnedPopupLayer({ desktopWindow, children }: WindowOwnedPopupLayerProps) {
  const { t } = useI18n();
  const { currentDesktopId, showDesktopSessionByDesktop } = useWindowManager();
  const transientPopupLayer = useDesktopTransientPopupLayer();
  const popupLayerRef = useRef<HTMLElement | null>(null);
  const [popupLayer, setPopupLayer] = useState<HTMLElement | null>(null);
  const [dismissGeneration, setDismissGeneration] = useState(0);
  const isHidden =
    desktopWindow.state === "minimized" ||
    desktopWindow.desktopId !== currentDesktopId ||
    (showDesktopSessionByDesktop[desktopWindow.desktopId]?.windowIds.includes(desktopWindow.id) ?? false);
  const dismissPopups = useCallback(() => {
    setDismissGeneration((generation) => generation + 1);
  }, []);
  const containsPopupTarget = useCallback((target: EventTarget | null) => {
    return target instanceof Node && popupLayerRef.current?.contains(target) === true;
  }, []);
  const setPopupLayerElement = useCallback((element: HTMLElement | null) => {
    popupLayerRef.current = element;
    setPopupLayer(element);
  }, []);

  useEffect(() => {
    if (isHidden) {
      dismissPopups();
    }
  }, [dismissPopups, isHidden]);

  const contextValue = useMemo<WindowOwnedPopupContextValue>(
    () => ({
      windowId: desktopWindow.id,
      popupLayerRef,
      popupLayer,
      dismissGeneration,
      containsPopupTarget,
      dismissPopups,
    }),
    [containsPopupTarget, desktopWindow.id, dismissGeneration, dismissPopups, popupLayer],
  );

  const popupLayerElement = (
    <section
      ref={setPopupLayerElement}
      className="window-owned-popup-layer"
      aria-label={t("desktop.popupsFor", { title: desktopWindow.title })}
      data-window-id={desktopWindow.id}
      hidden={isHidden}
      style={{ zIndex: desktopWindow.zIndex }}
    />
  );

  return (
    <WindowOwnedPopupContext.Provider value={contextValue}>
      {children}
      {transientPopupLayer?.layer ? createPortal(popupLayerElement, transientPopupLayer.layer) : popupLayerElement}
    </WindowOwnedPopupContext.Provider>
  );
}
