import { createContext, useContext, type RefObject } from "react";

export type DesktopTransientPopupContextValue = {
  readonly layerRef: RefObject<HTMLElement | null>;
  readonly layer: HTMLElement | null;
  setLayerElement(element: HTMLElement | null): void;
};

export const DesktopTransientPopupContext = createContext<DesktopTransientPopupContextValue | null>(null);

export function useDesktopTransientPopupLayer(): DesktopTransientPopupContextValue | null {
  return useContext(DesktopTransientPopupContext);
}
