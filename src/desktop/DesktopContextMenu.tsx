import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { useApplicationMenuDismissal } from "../apps/useApplicationMenuDismissal";
import type { ScreenArea } from "../window-manager/types";
import { useMeasuredPopupPosition } from "./useMeasuredPopupPosition";
import {
  clampDesktopContextMenuPosition,
  getDesktopContextMenuEntries,
  getDesktopPopupLocalPosition,
  getDesktopScreenAreaLocalBounds,
  type DesktopContextMenuAction,
  type DesktopContextMenuState,
} from "./desktopContextMenuModel";
import { toLogicalRect } from "./desktopUiScale";
import { useI18n } from "../i18n/useI18n";

type DesktopContextMenuProps = {
  readonly menuState: Exclude<DesktopContextMenuState, null> | null;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly screenArea: ScreenArea;
  readonly canEmptyTrash: boolean;
  readonly onDismiss: () => void;
  readonly onAction: (action: DesktopContextMenuAction) => void;
};

export function DesktopContextMenu({
  containerRef,
  menuState,
  onAction,
  onDismiss,
  screenArea,
  canEmptyTrash,
}: DesktopContextMenuProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLElement | null>(null);
  const resolvePosition = useCallback((menu: HTMLElement, request: Exclude<DesktopContextMenuState, null>) => {
    const container = containerRef.current;

    if (!container) {
      return null;
    }

    const containerBounds = toLogicalRect(container.getBoundingClientRect());

    return clampDesktopContextMenuPosition(
      getDesktopPopupLocalPosition(request, containerBounds),
      (() => {
        const bounds = toLogicalRect(menu.getBoundingClientRect());
        return { width: bounds.width, height: bounds.height };
      })(),
      getDesktopScreenAreaLocalBounds(screenArea, containerBounds),
    );
  }, [containerRef, screenArea]);
  const { isPositioned, position } = useMeasuredPopupPosition(menuState, menuRef, resolvePosition);

  useApplicationMenuDismissal({
    isOpen: menuState !== null,
    menuBarRef: menuRef,
    onDismiss,
  });

  useLayoutEffect(() => {
    if (menuState !== null && isPositioned) {
      menuRef.current?.focus({ preventScroll: true });
    }
  }, [isPositioned, menuState]);

  if (menuState === null) {
    return null;
  }

  const entries = getDesktopContextMenuEntries(menuState, canEmptyTrash);
  const labels = {
    "run-command": t("desktop.runCommand"),
    "configure-desktop": t("desktop.configure"),
    "lock-session": t("common.lockSession"),
    logout: t("desktop.logout"),
    "open-icon": t("desktop.open"),
    "empty-trash": t("desktop.emptyTrash"),
  } as const;

  return (
    <section
      ref={menuRef}
      className="desktop-context-menu"
      role="menu"
      tabIndex={-1}
      aria-label={t("desktop.background")}
      style={position ?? { visibility: "hidden", pointerEvents: "none" }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      {entries.map((entry, index) =>
        entry.kind === "separator" ? (
          <div key={`separator-${index}`} className="desktop-context-menu__separator k-context-menu-separator" role="separator" />
        ) : (
          <button key={entry.action} type="button" role="menuitem" disabled={entry.enabled === false} title={entry.action === "empty-trash" && !canEmptyTrash ? t("desktop.trashAlreadyEmpty") : labels[entry.action]} onClick={() => onAction(entry.action)}>
            {labels[entry.action]}
          </button>
        ),
      )}
    </section>
  );
}
