import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type RefObject } from "react";
import { useI18n } from "../../i18n/useI18n";
import { useMeasuredPopupPosition } from "../../desktop/useMeasuredPopupPosition";
import { useApplicationMenuDismissal } from "../useApplicationMenuDismissal";
import type { ScreenArea } from "../../window-manager/types";
import {
  clampKonquerorContextMenuPosition,
  getKonquerorSubmenuPosition,
  getKonquerorPopupLocalPosition,
  getKonquerorScreenAreaLocalBounds,
  type KonquerorContextMenuAction,
  type KonquerorContextMenuActionEntry,
  type KonquerorContextMenuEntry,
  type KonquerorContextMenuState,
} from "./contextMenuModel";
import {
  initialKonquerorContextSubmenuState,
  KONQUEROR_SUBMENU_CLOSE_GRACE_MS,
  konquerorContextSubmenuReducer,
  type KonquerorContextSubmenuId,
} from "./contextSubmenuState";
import { toLogicalRect } from "../../desktop/desktopUiScale";
import { translateKonquerorContextMenuEntries } from "./konquerorI18n";

type KonquerorContextMenuProps = {
  readonly menuState: Exclude<KonquerorContextMenuState, null> | null;
  readonly entries: readonly KonquerorContextMenuEntry[];
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly screenArea: ScreenArea;
  readonly onDismiss: () => void;
  readonly onAction: (action: KonquerorContextMenuAction) => void;
};

export function KonquerorContextMenu({
  containerRef,
  entries,
  menuState,
  onAction,
  onDismiss,
  screenArea,
}: KonquerorContextMenuProps) {
  const { t } = useI18n();
  const localizedEntries = useMemo(() => translateKonquerorContextMenuEntries(t, entries), [entries, t]);
  const menuRef = useRef<HTMLElement | null>(null);
  const submenuRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submenuState, dispatchSubmenu] = useReducer(konquerorContextSubmenuReducer, initialKonquerorContextSubmenuState);
  const [submenuPosition, setSubmenuPosition] = useState({ opensLeft: false, offsetX: 0, offsetY: 0 });
  const clearPendingClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const closeAllSubmenus = useCallback(() => {
    clearPendingClose();
    dispatchSubmenu({ type: "close-all" });
  }, [clearPendingClose]);
  const openSubmenu = useCallback((submenuId: KonquerorContextSubmenuId) => {
    clearPendingClose();
    dispatchSubmenu({ type: "open", submenuId });
  }, [clearPendingClose]);
  const cancelSubmenuClose = useCallback((submenuId: KonquerorContextSubmenuId) => {
    clearPendingClose();
    dispatchSubmenu({ type: "cancel-close", submenuId });
  }, [clearPendingClose]);
  const scheduleSubmenuClose = useCallback((submenuId: KonquerorContextSubmenuId) => {
    clearPendingClose();
    dispatchSubmenu({ type: "schedule-close", submenuId });
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      dispatchSubmenu({ type: "close-if-pending", submenuId });
    }, KONQUEROR_SUBMENU_CLOSE_GRACE_MS);
  }, [clearPendingClose]);

  useApplicationMenuDismissal({
    isOpen: menuState !== null,
    menuBarRef: menuRef,
    onDismiss,
  });

  const resolvePosition = useCallback((menu: HTMLElement, request: Exclude<KonquerorContextMenuState, null>) => {
    const container = containerRef.current;

    if (!container) {
      return null;
    }

    const containerBounds = toLogicalRect(container.getBoundingClientRect());
    const menuBounds = toLogicalRect(menu.getBoundingClientRect());

    return clampKonquerorContextMenuPosition(
      getKonquerorPopupLocalPosition(request, containerBounds),
      { width: menuBounds.width, height: menuBounds.height },
      getKonquerorScreenAreaLocalBounds(screenArea, containerBounds),
    );
  }, [containerRef, screenArea]);
  const { isPositioned, position } = useMeasuredPopupPosition(menuState, menuRef, resolvePosition);

  useLayoutEffect(() => {
    if (menuState !== null && isPositioned) {
      menuRef.current?.focus({ preventScroll: true });
    }
  }, [isPositioned, menuState]);

  useEffect(() => {
    if (menuState === null || submenuState.openSubmenuId === null) {
      return;
    }
    const container = containerRef.current;
    const submenu = submenuRef.current;
    const trigger = menuRef.current?.querySelector<HTMLElement>(`[data-submenu-id="${submenuState.openSubmenuId}"]`);
    if (!container || !submenu || !trigger) {
      return;
    }
    const submenuBounds = toLogicalRect(submenu.getBoundingClientRect());
    const triggerBounds = toLogicalRect(trigger.getBoundingClientRect());
    setSubmenuPosition(getKonquerorSubmenuPosition(triggerBounds, submenuBounds, {
      left: screenArea.x,
      top: screenArea.y,
      right: screenArea.x + screenArea.width,
      bottom: screenArea.y + screenArea.height,
    }));
  }, [containerRef, menuState, screenArea, submenuState.openSubmenuId]);

  useEffect(() => {
    if (menuState !== null) {
      return;
    }
    closeAllSubmenus();
  }, [closeAllSubmenus, menuState]);

  useEffect(() => () => clearPendingClose(), [clearPendingClose]);

  if (menuState === null) {
    return null;
  }

  return (
    <section
      ref={menuRef}
      className="konqueror-context-menu"
      role="menu"
      tabIndex={-1}
      aria-label={t("konqueror.context.menu")}
      style={position ?? { visibility: "hidden", pointerEvents: "none" }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      {localizedEntries.map((entry, index) => {
        if (entry.kind === "separator") {
          return <div key={`separator-${index}`} className="konqueror-context-menu__separator" role="separator" />;
        }
        if (entry.kind === "submenu") {
          const isOpen = submenuState.openSubmenuId === entry.id;
          return (
            <div
              key={entry.id}
              className="konqueror-context-menu__submenu-container"
              onPointerEnter={() => cancelSubmenuClose(entry.id)}
              onPointerLeave={() => scheduleSubmenuClose(entry.id)}
            >
              <button
                data-submenu-id={entry.id}
                type="button"
                role="menuitem"
                title={entry.title}
                disabled={!entry.enabled}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onPointerEnter={() => entry.enabled && openSubmenu(entry.id)}
                onClick={() => entry.enabled && openSubmenu(entry.id)}
              >
                <span className="konqueror-context-menu__marker" aria-hidden="true" />
                <span className="konqueror-context-menu__label">{entry.label}</span>
                <span className="konqueror-context-menu__submenu-arrow" aria-hidden="true">&#9654;</span>
              </button>
              {isOpen ? (
                <section
                  ref={submenuRef}
                  className="konqueror-context-menu konqueror-context-menu--submenu"
                  role="menu"
                  aria-label={t("common.submenu", { name: entry.label })}
                  style={submenuPosition.opensLeft
                    ? {
                        right: "calc(100% - 2px)",
                        transform: `translate(${submenuPosition.offsetX}px, ${submenuPosition.offsetY}px)`,
                      }
                    : {
                        left: "calc(100% - 2px)",
                        transform: `translate(${submenuPosition.offsetX}px, ${submenuPosition.offsetY}px)`,
                      }}
                  onPointerEnter={() => cancelSubmenuClose(entry.id)}
                  onPointerLeave={() => scheduleSubmenuClose(entry.id)}
                >
                  {entry.items.map((item, index) => item.kind === "separator"
                    ? <div key={`separator-${index}`} className="konqueror-context-menu__separator" role="separator" />
                    : renderAction(item, () => {
                      closeAllSubmenus();
                      onAction(item.action);
                    }, () => cancelSubmenuClose(entry.id)))}
                </section>
              ) : null}
            </div>
          );
        }
        return renderAction(entry, () => {
          closeAllSubmenus();
          onAction(entry.action);
        }, closeAllSubmenus);
      })}
    </section>
  );
}

function renderAction(
  entry: KonquerorContextMenuActionEntry,
  onAction: () => void,
  onHover: () => void,
) {
  return (
    <button
      key={entry.action}
      type="button"
      role="menuitem"
      title={entry.title}
      disabled={!entry.enabled}
      onPointerEnter={onHover}
      onClick={() => entry.enabled && onAction()}
    >
      <span className="konqueror-context-menu__marker" aria-hidden="true">{entry.checked ? "✓" : ""}</span>
      <span className="konqueror-context-menu__label">{entry.label}</span>
      <span className="konqueror-context-menu__submenu-arrow" aria-hidden="true" />
    </button>
  );
}
