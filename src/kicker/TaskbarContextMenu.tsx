import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import type { LaunchApplicationOptions } from "../application-runtime/types";
import { useApplicationMenuDismissal } from "../apps/useApplicationMenuDismissal";
import { useMeasuredPopupPosition } from "../desktop/useMeasuredPopupPosition";
import type { ScreenArea } from "../window-manager/types";
import { KMenuPanel } from "./k-menu/KMenuPanel";
import { initialKMenuState, kMenuReducer } from "./k-menu/menuState";
import { getTaskbarContextMenuEntries, getTaskbarContextMenuPosition, type TaskbarContextMenuState } from "./taskbarContextMenuModel";
import { toLogicalRect } from "../desktop/desktopUiScale";
import { useI18n } from "../i18n/useI18n";

type TaskbarContextMenuProps = {
  readonly menuState: TaskbarContextMenuState | null;
  readonly screenArea: ScreenArea;
  readonly onDismiss: () => void;
  readonly onLaunchApplication: (appId: string, options?: LaunchApplicationOptions) => void;
};

const menuId = "taskbar-context-menu";

export function TaskbarContextMenu({ menuState, onDismiss, onLaunchApplication, screenArea }: TaskbarContextMenuProps) {
  const { t } = useI18n();
  const entries = getTaskbarContextMenuEntries();
  const panelRef = useRef<HTMLElement | null>(null);
  const setPanelRef = useCallback((element: HTMLElement | null) => {
    panelRef.current = element;
  }, []);
  const [state, dispatch] = useReducer(kMenuReducer, initialKMenuState);
  const resolvePosition = useCallback((panel: HTMLElement, request: TaskbarContextMenuState) =>
    getTaskbarContextMenuPosition(
      request,
      (() => {
        const bounds = toLogicalRect(panel.getBoundingClientRect());
        return { width: bounds.width, height: bounds.height };
      })(),
      screenArea,
    ),
  [screenArea]);
  const { isPositioned, position } = useMeasuredPopupPosition(menuState, panelRef, resolvePosition);

  useApplicationMenuDismissal({
    isOpen: menuState !== null,
    menuBarRef: panelRef,
    popupRefs: [panelRef],
    onDismiss,
  });

  useEffect(() => {
    dispatch(menuState === null
      ? { type: "close" }
      : { type: "open" });
  }, [entries, menuState]);

  useLayoutEffect(() => {
    if (menuState !== null && isPositioned) {
      panelRef.current?.focus({ preventScroll: true });
    }
  }, [isPositioned, menuState]);

  const closeMenu = useCallback(() => {
    dispatch({ type: "close" });
    onDismiss();
  }, [onDismiss]);

  if (menuState === null) {
    return null;
  }

  const launchAndClose = (appId: string, options?: LaunchApplicationOptions) => {
    closeMenu();
    onLaunchApplication(appId, options);
  };

  return (
    <KMenuPanel
      menuId={menuId}
      entries={entries}
      state={state}
      popupClassName="taskbar-context-menu-popup"
      popupStyle={position ?? { visibility: "hidden", pointerEvents: "none" }}
      panelClassName="k-menu-panel taskbar-context-menu-panel"
      panelRef={setPanelRef}
      submenuBounds={screenArea}
      showBrand={false}
      menuVariant="context"
      selectFirstSubmenuItem={false}
      ariaLabel={t("kicker.taskbarContextMenu")}
      labelOverrides={{
        "taskbar-configure-panel": t("kicker.configurePanel"),
        "taskbar-help": t("kicker.help"),
        "taskbar-about-kde-panel": t("kicker.aboutPanel"),
        "taskbar-about-kde": t("kicker.aboutKde"),
      }}
      onSetActiveItem={(itemId) => dispatch({ type: "set-active-item", itemId })}
      onOpenSubmenu={(entry) => dispatch({ type: "open-submenu", submenuId: entry.id, enabled: entry.enabled })}
      onCloseSubmenu={() => dispatch({ type: "close-submenu" })}
      onCloseMenu={closeMenu}
      onLaunchApplication={launchAndClose}
    />
  );
}
