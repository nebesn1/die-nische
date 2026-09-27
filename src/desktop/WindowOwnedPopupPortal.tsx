import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useWindowOwnedPopupLayer } from "./WindowOwnedPopupContext";

type WindowOwnedPopupPortalProps = {
  readonly children: ReactNode;
};

export function WindowOwnedPopupPortal({ children }: WindowOwnedPopupPortalProps) {
  const popupContext = useWindowOwnedPopupLayer();

  if (!popupContext?.popupLayer) {
    return <>{children}</>;
  }

  return createPortal(children, popupContext.popupLayer);
}
