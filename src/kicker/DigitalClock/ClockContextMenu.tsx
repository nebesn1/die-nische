import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type RefObject } from "react";
import type { LaunchApplicationOptions } from "../../application-runtime/types";
import { useApplicationMenuDismissal } from "../../apps/useApplicationMenuDismissal";
import { useMeasuredPopupPosition } from "../../desktop/useMeasuredPopupPosition";
import type { ScreenArea } from "../../window-manager/types";
import { KMenuPanel } from "../k-menu/KMenuPanel";
import { initialKMenuState, kMenuReducer } from "../k-menu/menuState";
import type { KMenuEntry } from "../k-menu/types";
import { getClockContextMenuPosition, type ClockContextMenuState } from "./clockContextMenuPosition";
import { toLogicalRect } from "../../desktop/desktopUiScale";
import { useI18n } from "../../i18n/useI18n";

type ClockContextMenuProps = {
  readonly menuState: ClockContextMenuState | null;
  readonly clockRef: RefObject<HTMLElement | null>;
  readonly screenArea: ScreenArea;
  readonly onDismiss: () => void;
  readonly onLaunchApplication: (appId: string, options?: LaunchApplicationOptions) => void;
};

const entries: readonly KMenuEntry[] = Object.freeze([
  {
    type: "application",
    id: "clock-configure",
    label: "Configure Clock...",
    iconId: "panel-settings",
    appId: "configure-clock",
    enabled: true,
  },
]);

export function ClockContextMenu({ clockRef, menuState, onDismiss, onLaunchApplication, screenArea }: ClockContextMenuProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLElement | null>(null);
  const setPanelRef = useCallback((element: HTMLElement | null) => {
    panelRef.current = element;
  }, []);
  const [state, dispatch] = useReducer(kMenuReducer, initialKMenuState);
  const resolvePosition = useCallback((panel: HTMLElement, request: ClockContextMenuState) => getClockContextMenuPosition(
    request,
    (() => {
      const bounds = toLogicalRect(panel.getBoundingClientRect());
      return { width: bounds.width, height: bounds.height };
    })(),
    screenArea,
  ), [screenArea]);
  const { isPositioned, position } = useMeasuredPopupPosition(menuState, panelRef, resolvePosition);

  useApplicationMenuDismissal({
    isOpen: menuState !== null,
    menuBarRef: clockRef,
    popupRefs: [panelRef],
    onDismiss,
  });

  useEffect(() => {
    dispatch(menuState === null
      ? { type: "close" }
      : { type: "open" });
  }, [menuState]);

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

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <KMenuPanel
        menuId="clock-context-menu"
        entries={entries}
        state={state}
        popupClassName="clock-context-menu-popup"
        popupStyle={position ?? { visibility: "hidden", pointerEvents: "none" }}
        panelClassName="k-menu-panel clock-context-menu-panel"
        panelRef={setPanelRef}
        submenuBounds={screenArea}
        showBrand={false}
        menuVariant="context"
        selectFirstSubmenuItem={false}
        ariaLabel={t("kicker.clockContextMenu")}
        labelOverrides={{ "clock-configure": t("kicker.configureClock") }}
        onSetActiveItem={(itemId) => dispatch({ type: "set-active-item", itemId })}
        onOpenSubmenu={(entry) => dispatch({ type: "open-submenu", submenuId: entry.id, enabled: entry.enabled })}
        onCloseSubmenu={() => dispatch({ type: "close-submenu" })}
        onCloseMenu={closeMenu}
        onLaunchApplication={(appId) => {
          closeMenu();
          onLaunchApplication(appId);
        }}
      />
    </div>
  );
}
