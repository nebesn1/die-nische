import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { WindowIcon } from "../icons/windowIconRegistry";
import type { DesktopWindow } from "../window-manager/types";
import { getTaskWindowPresentation } from "./taskWindowPresentation";
import { useI18n } from "../i18n/useI18n";

type TaskGroupPopupProps = {
  readonly appId: string;
  readonly members: readonly DesktopWindow[];
  readonly activeWindowId: string | null;
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
  readonly popupRef?: RefObject<HTMLElement | null>;
  getWindowIconId(desktopWindow: DesktopWindow): string;
  onClose(returnFocus: boolean): void;
  onSelectWindow(windowId: string): void;
};

export function TaskGroupPopup({
  activeWindowId,
  appId,
  getWindowIconId,
  left,
  maxHeight,
  members,
  onClose,
  onSelectWindow,
  popupRef: externalPopupRef,
  top,
}: TaskGroupPopupProps) {
  const { t } = useI18n();
  const internalPopupRef = useRef<HTMLElement | null>(null);
  const popupRef = externalPopupRef ?? internalPopupRef;

  useEffect(() => {
    const focusId = window.requestAnimationFrame(() => {
      const activeMember = activeWindowId
        ? popupRef.current?.querySelector<HTMLButtonElement>(`[data-task-group-member="${activeWindowId}"]`)
        : null;
      const firstMember = popupRef.current?.querySelector<HTMLButtonElement>("[data-task-group-member]");
      (activeMember ?? firstMember)?.focus();
    });

    return () => window.cancelAnimationFrame(focusId);
  }, [activeWindowId, members, popupRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const buttons = Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>("[data-task-group-member]") ?? []);
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
      return;
    }

    if (buttons.length === 0) {
      return;
    }

    const focusIndex = event.key === "Home"
      ? 0
      : event.key === "End"
      ? buttons.length - 1
      : event.key === "ArrowDown"
      ? Math.min(Math.max(currentIndex, 0) + 1, buttons.length - 1)
      : event.key === "ArrowUp"
      ? Math.max((currentIndex < 0 ? 0 : currentIndex) - 1, 0)
      : null;

    if (focusIndex !== null) {
      event.preventDefault();
      buttons[focusIndex]?.focus();
    }
  };

  return (
    <section
      ref={popupRef}
      className="task-group-popup"
      role="menu"
      aria-label={t("common.windows", { name: appId })}
      style={{ left, top, maxHeight }}
      onKeyDown={handleKeyDown}
    >
      {members.map((desktopWindow) => {
        const presentation = getTaskWindowPresentation(desktopWindow);

        return (
          <button
            key={desktopWindow.id}
            type="button"
            role="menuitem"
            className={`task-group-popup__item${desktopWindow.id === activeWindowId ? " is-active" : ""}${presentation.isMinimized ? " is-minimized" : ""}`}
            aria-label={`${presentation.isMinimized ? t("common.restore") : desktopWindow.isActive ? t("common.minimize") : t("common.activate")} ${desktopWindow.title}`}
            data-task-group-member={desktopWindow.id}
            title={desktopWindow.title}
            onClick={() => onSelectWindow(desktopWindow.id)}
          >
            <WindowIcon
              className={`task-window-icon task-window-icon--${presentation.iconState}`}
              data-task-window-icon-state={presentation.iconState}
              iconId={getWindowIconId(desktopWindow)}
              width="14"
              height="14"
              aria-hidden="true"
              focusable="false"
            />
            <span>{desktopWindow.title}</span>
          </button>
        );
      })}
    </section>
  );
}
