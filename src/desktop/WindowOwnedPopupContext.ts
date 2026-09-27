import { createContext, useContext, type RefObject } from "react";

export type WindowOwnedPopupContextValue = {
  readonly windowId: string;
  readonly popupLayerRef: RefObject<HTMLElement | null>;
  readonly popupLayer: HTMLElement | null;
  readonly dismissGeneration: number;
  /** Identifies DOM events from this window's portaled popup family. */
  containsPopupTarget(target: EventTarget | null): boolean;
  dismissPopups(): void;
};

export const WindowOwnedPopupContext = createContext<WindowOwnedPopupContextValue | null>(null);

export function useWindowOwnedPopupLayer(): WindowOwnedPopupContextValue | null {
  return useContext(WindowOwnedPopupContext);
}
