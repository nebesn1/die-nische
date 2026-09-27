import { useEffect, useRef, type RefObject } from "react";
import { CLOSE_SHELL_POPUPS_EVENT } from "../shell/shellPopupEvents";

type ApplicationMenuDismissalOptions = {
  readonly isOpen: boolean;
  readonly menuBarRef: RefObject<HTMLElement | null>;
  readonly popupRefs?: readonly RefObject<HTMLElement | null>[];
  readonly onDismiss: () => void;
};

const noPopupRefs: readonly RefObject<HTMLElement | null>[] = [];

/**
 * Dismisses an application menubar popup without consuming the click that
 * activated the next desktop or window target.
 */
export function useApplicationMenuDismissal({
  isOpen,
  menuBarRef,
  popupRefs = noPopupRefs,
  onDismiss,
}: ApplicationMenuDismissalOptions) {
  const dismissRef = useRef(onDismiss);
  const popupRefsRef = useRef(popupRefs);

  useEffect(() => {
    dismissRef.current = onDismiss;
    popupRefsRef.current = popupRefs;
  }, [onDismiss, popupRefs]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        (menuBarRef.current?.contains(target) || popupRefsRef.current.some((popupRef) => popupRef.current?.contains(target)))
      ) {
        return;
      }

      dismissRef.current();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isOpen, menuBarRef]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleShellPopupClose = () => dismissRef.current();
    document.addEventListener(CLOSE_SHELL_POPUPS_EVENT, handleShellPopupClose);
    return () => document.removeEventListener(CLOSE_SHELL_POPUPS_EVENT, handleShellPopupClose);
  }, [isOpen]);
}
