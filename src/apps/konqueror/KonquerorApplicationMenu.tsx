import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type RefObject } from "react";
import { useI18n } from "../../i18n/useI18n";
import { useMeasuredPopupPosition } from "../../desktop/useMeasuredPopupPosition";
import { WindowOwnedPopupPortal } from "../../desktop/WindowOwnedPopupPortal";
import type { ScreenArea } from "../../window-manager/types";
import { getKonquerorApplicationMenuPopupPosition, getKonquerorSubmenuPosition } from "./applicationMenuPosition";
import {
  KONQUEROR_APPLICATION_MENU_SUBMENU_CLOSE_GRACE_MS,
  initialKonquerorApplicationMenuSubmenuState,
  konquerorApplicationMenuSubmenuReducer,
} from "./applicationMenuSubmenuState";
import type {
  KonquerorApplicationMenu,
  KonquerorApplicationMenuAction,
  KonquerorApplicationMenuActionEntry,
  KonquerorApplicationMenuEntry,
  KonquerorApplicationMenuRequest,
  KonquerorApplicationMenuSubmenuEntry,
} from "./applicationMenuModel";
import { EditIcon, FolderIcon, NewFolderIcon } from "./icons";
import { StarIcon } from "../../icons/IconComponents";
import { toLogicalRect } from "../../desktop/desktopUiScale";
import { translateKonquerorApplicationMenuEntries } from "./konquerorI18n";
import { useTouchClickGuard } from "../../input/pointerInteraction";
import { APPLICATION_MENUBAR_CLASS } from "../applicationMenubarPolicy";

type KonquerorApplicationMenuProps = {
  readonly menuBarRef: RefObject<HTMLElement | null>;
  readonly popupRef: RefObject<HTMLDivElement | null>;
  readonly screenArea: ScreenArea;
  readonly openMenu: KonquerorApplicationMenuRequest | null;
  readonly entries: readonly KonquerorApplicationMenuEntry[];
  readonly showPlayerMenu?: boolean;
  readonly onToggleMenu: (menu: KonquerorApplicationMenu) => void;
  readonly onAction: (action: KonquerorApplicationMenuAction, parentFolderId?: string | null, bookmarkId?: string) => void;
  readonly onEscape: () => void;
};

const menus: readonly { readonly id: KonquerorApplicationMenu; readonly label: string }[] = [
  { id: "location", label: "Location" },
  { id: "edit", label: "Edit" },
  { id: "view", label: "View" },
  { id: "go", label: "Go" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "player", label: "Player" },
  { id: "tools", label: "Tools" },
  { id: "settings", label: "Settings" },
  { id: "window", label: "Window" },
  { id: "help", label: "Help" },
];

type SubmenuPosition = {
  readonly submenuId: KonquerorApplicationMenuSubmenuEntry["id"] | null;
  readonly opensLeft: boolean;
  readonly offsetX: number;
  readonly offsetY: number;
};

const initialSubmenuPosition: SubmenuPosition = {
  submenuId: null,
  opensLeft: false,
  offsetX: 0,
  offsetY: 0,
};

type MenuActionButtonProps = {
  readonly entry: KonquerorApplicationMenuActionEntry;
  readonly onAction: (action: KonquerorApplicationMenuAction, parentFolderId?: string | null, bookmarkId?: string) => void;
  readonly onHover?: () => void;
};

function KonquerorMenuIcon({ icon }: { readonly icon: KonquerorApplicationMenuActionEntry["icon"] | KonquerorApplicationMenuSubmenuEntry["icon"] }) {
  if (icon === undefined) return <span className="konqueror-menu-check" aria-hidden="true" />;
  const props = { className: "konqueror-menu-icon", "aria-hidden": true };
  switch (icon) {
    case "bookmark": return <StarIcon {...props} />;
    case "folder":
    case "bookmark-tabs": return <FolderIcon {...props} />;
    case "new-folder": return <NewFolderIcon {...props} />;
    case "edit": return <EditIcon {...props} />;
  }
}

function KonquerorApplicationMenuActionButton({ entry, onAction, onHover }: MenuActionButtonProps) {
  return (
    <button
      type="button"
      role={entry.checkKind === "radio" ? "menuitemradio" : entry.checkKind === "checkbox" ? "menuitemcheckbox" : "menuitem"}
      aria-checked={entry.checkKind === undefined ? undefined : entry.checked}
      disabled={!entry.enabled}
      title={entry.title}
      onPointerEnter={onHover}
      onClick={() => entry.enabled && onAction(entry.action, entry.parentFolderId, entry.bookmarkId)}
    >
      {entry.checked ? <span className="konqueror-menu-check" aria-hidden="true">✓</span> : <KonquerorMenuIcon icon={entry.icon} />}
      <span className="konqueror-menu-label">{entry.label}</span>
      {entry.shortcut ? <span className="konqueror-menu-shortcut">{entry.shortcut}</span> : null}
    </button>
  );
}

type KonquerorApplicationMenuSubmenuProps = {
  readonly entry: KonquerorApplicationMenuSubmenuEntry;
  readonly onAction: (action: KonquerorApplicationMenuAction, parentFolderId?: string | null, bookmarkId?: string) => void;
  readonly screenArea: ScreenArea;
};

/** Generic recursive KDE menu primitive; each level owns its direct child hover state. */
function KonquerorApplicationMenuSubmenu({ entry, onAction, screenArea }: KonquerorApplicationMenuSubmenuProps) {
  const { t } = useI18n();
  const submenuRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submenuState, dispatchSubmenu] = useReducer(
    konquerorApplicationMenuSubmenuReducer,
    initialKonquerorApplicationMenuSubmenuState,
  );
  const [submenuPosition, setSubmenuPosition] = useState<SubmenuPosition>(initialSubmenuPosition);
  const clearPendingClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const openSubmenu = useCallback((submenuId: KonquerorApplicationMenuSubmenuEntry["id"]) => {
    clearPendingClose();
    dispatchSubmenu({ type: "open", submenuId });
    setSubmenuPosition((current) => current.submenuId === submenuId ? current : initialSubmenuPosition);
  }, [clearPendingClose]);
  const cancelSubmenuClose = useCallback((submenuId: KonquerorApplicationMenuSubmenuEntry["id"]) => {
    clearPendingClose();
    dispatchSubmenu({ type: "cancel-close", submenuId });
  }, [clearPendingClose]);
  const scheduleSubmenuClose = useCallback((submenuId: KonquerorApplicationMenuSubmenuEntry["id"]) => {
    clearPendingClose();
    dispatchSubmenu({ type: "schedule-close", submenuId });
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      dispatchSubmenu({ type: "close-if-pending", submenuId });
      setSubmenuPosition((current) => current.submenuId === submenuId ? initialSubmenuPosition : current);
    }, KONQUEROR_APPLICATION_MENU_SUBMENU_CLOSE_GRACE_MS);
  }, [clearPendingClose]);

  const isOpen = submenuState.openSubmenuId === entry.id;
  const isSubmenuPositioned = submenuPosition.submenuId === entry.id;
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !submenuRef.current) {
      return;
    }

    const nextPosition = getKonquerorSubmenuPosition(toLogicalRect(triggerRef.current.getBoundingClientRect()), toLogicalRect(submenuRef.current.getBoundingClientRect()), {
      left: screenArea.x,
      top: screenArea.y,
      right: screenArea.x + screenArea.width,
      bottom: screenArea.y + screenArea.height,
    });
    setSubmenuPosition({ submenuId: entry.id, ...nextPosition });
  }, [entry.id, isOpen, screenArea]);

  useEffect(() => () => clearPendingClose(), [clearPendingClose]);

  return (
    <div
      className="konqueror-menu-popup__submenu-container"
      onPointerEnter={() => cancelSubmenuClose(entry.id)}
      onPointerLeave={() => scheduleSubmenuClose(entry.id)}
    >
      <button
        ref={triggerRef}
        data-submenu-id={entry.id}
        type="button"
        role="menuitem"
        disabled={!entry.enabled}
        title={entry.title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onPointerEnter={() => entry.enabled && openSubmenu(entry.id)}
        onClick={() => entry.enabled && openSubmenu(entry.id)}
      >
        <KonquerorMenuIcon icon={entry.icon} />
        <span className="konqueror-menu-label">{entry.label}</span>
        <span className="konqueror-menu-submenu-arrow" aria-hidden="true">&#9654;</span>
      </button>
      {isOpen ? (
        <section
          ref={submenuRef}
          className="konqueror-menu-popup konqueror-menu-popup--submenu"
          role="menu"
          aria-label={t("common.submenu", { name: entry.label })}
          style={!isSubmenuPositioned
            ? { visibility: "hidden", pointerEvents: "none" }
            : submenuPosition.opensLeft
            ? { right: "calc(100% - 2px)", transform: `translate(${submenuPosition.offsetX}px, ${submenuPosition.offsetY}px)` }
            : { left: "calc(100% - 2px)", transform: `translate(${submenuPosition.offsetX}px, ${submenuPosition.offsetY}px)` }}
          onPointerEnter={() => cancelSubmenuClose(entry.id)}
          onPointerLeave={() => scheduleSubmenuClose(entry.id)}
        >
          {entry.items.map((item, index) => item.kind === "separator"
            ? <hr key={`separator-${index}`} className="konqueror-menu-separator" role="separator" />
            : item.kind === "submenu"
            ? <KonquerorApplicationMenuSubmenu key={item.id} entry={item} onAction={onAction} screenArea={screenArea} />
            : <KonquerorApplicationMenuActionButton key={`${item.action}-${item.bookmarkId ?? item.parentFolderId ?? "root"}`} entry={item} onAction={onAction} onHover={() => cancelSubmenuClose(entry.id)} />)}
        </section>
      ) : null}
    </div>
  );
}

export function KonquerorApplicationMenu({ entries, menuBarRef, onAction, onEscape, onToggleMenu, openMenu, popupRef, screenArea, showPlayerMenu = false }: KonquerorApplicationMenuProps) {
  const { t } = useI18n();
  const touchClickGuard = useTouchClickGuard<HTMLElement>();
  const triggerRefs = useRef<Partial<Record<KonquerorApplicationMenu, HTMLButtonElement | null>>>({});
  const activeMenu = openMenu?.menu ?? null;
  const visibleMenus = showPlayerMenu ? menus : menus.filter((menu) => menu.id !== "player");
  const localizedEntries = useMemo(() => translateKonquerorApplicationMenuEntries(t, entries), [entries, t]);
  const resolvePopupPosition = useCallback((popup: HTMLElement, request: KonquerorApplicationMenuRequest) => {
    const trigger = triggerRefs.current[request.menu];
    if (!trigger) return null;
    return getKonquerorApplicationMenuPopupPosition(
      toLogicalRect(trigger.getBoundingClientRect()),
      (() => {
        const bounds = toLogicalRect(popup.getBoundingClientRect());
        return { width: bounds.width, height: bounds.height };
      })(),
      screenArea,
    );
  }, [screenArea]);
  const { isPositioned, position } = useMeasuredPopupPosition(openMenu, popupRef, resolvePopupPosition);
  const executeAction = useCallback((action: KonquerorApplicationMenuAction, parentFolderId?: string | null, bookmarkId?: string) => {
    onAction(action, parentFolderId, bookmarkId);
  }, [onAction]);

  const popup = activeMenu !== null ? (
    <div
      ref={popupRef}
      className="konqueror-menu-popup"
      role="menu"
      aria-label={t("common.menu", { name: activeMenu === null ? "Konqueror" : t(`konqueror.menu.${activeMenu}` as Parameters<typeof t>[0]) })}
      data-menu-request-id={openMenu?.requestId}
      data-positioned={isPositioned}
      style={position ?? { visibility: "hidden", pointerEvents: "none" }}
    >
      {localizedEntries.map((entry, index) => entry.kind === "separator"
        ? <hr key={`separator-${index}`} className="konqueror-menu-separator" role="separator" />
        : entry.kind === "submenu"
        ? <KonquerorApplicationMenuSubmenu key={entry.id} entry={entry} onAction={executeAction} screenArea={screenArea} />
        : <KonquerorApplicationMenuActionButton key={`${entry.action}-${entry.bookmarkId ?? entry.parentFolderId ?? "root"}`} entry={entry} onAction={executeAction} />)}
    </div>
  ) : null;

  return (
    <nav
      ref={menuBarRef}
      className={`${APPLICATION_MENUBAR_CLASS} konqueror-menubar kde-chrome-surface`}
      aria-label={t("konqueror.menuBar")}
      onPointerDown={touchClickGuard.onPointerDown}
      onPointerMove={touchClickGuard.onPointerMove}
      onPointerUp={touchClickGuard.onPointerUp}
      onPointerCancel={touchClickGuard.onPointerCancel}
      onClickCapture={touchClickGuard.consumeClick}
      onKeyDown={(event) => {
        if (activeMenu !== null && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onEscape();
        }
      }}
    >
      {visibleMenus.map((menu) => (
        <div key={menu.id} className={`konqueror-application-menu-root konqueror-application-menu-root--${menu.id}`}>
          <button
            ref={(element) => { triggerRefs.current[menu.id] = element; }}
            type="button"
            className={`konqueror-menuitem${activeMenu === menu.id ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={activeMenu === menu.id}
            onClick={() => onToggleMenu(menu.id)}
          >
            {t(`konqueror.menu.${menu.id}` as Parameters<typeof t>[0])}
          </button>
        </div>
      ))}
      {popup ? <WindowOwnedPopupPortal>{popup}</WindowOwnedPopupPortal> : null}
    </nav>
  );
}
