import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { getApplicationMenuPopupPosition } from "../applicationMenuPosition";
import { useApplicationMenuDismissal } from "../useApplicationMenuDismissal";
import { WindowOwnedPopupPortal } from "../../desktop/WindowOwnedPopupPortal";
import { useWindowOwnedPopupLayer } from "../../desktop/WindowOwnedPopupContext";
import { useMeasuredPopupPosition } from "../../desktop/useMeasuredPopupPosition";
import { WindowManagerContext } from "../../window-manager/useWindowManager";
import { getKonsoleSchemaSubmenuPosition } from "./konsoleMenuPosition";
import { konsoleSchemas, type KonsoleSchemaId } from "./konsoleSchemas";
import {
  type KonsoleBookmarksMenuAction,
  type KonsoleBookmarksMenuEntry,
} from "./konsoleBookmarksMenuModel";
import { toLogicalRect } from "../../desktop/desktopUiScale";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/messages/en";
import { APPLICATION_MENUBAR_CLASS, useApplicationMenubarPolicy } from "../applicationMenubarPolicy";

type KonsoleTopMenuId = "session" | "edit" | "view" | "bookmarks" | "settings" | "help";

type KonsolePopupTrigger = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

type KonsoleMenuRequest = {
  readonly menu: KonsoleTopMenuId;
  readonly requestId: number;
  readonly trigger: KonsolePopupTrigger;
};

type KonsoleSchemaRequest = {
  readonly requestId: number;
  readonly trigger: KonsolePopupTrigger;
};

type KonsoleMenuBarProps = {
  readonly windowId?: string;
  readonly canCopy: boolean;
  readonly canPaste: boolean;
  readonly schemaId: KonsoleSchemaId;
  readonly onNewShell: () => void;
  readonly onNewWindow?: () => void;
  readonly onRenameSession: () => void;
  readonly onQuit: () => void;
  readonly onCopy: () => void;
  readonly onPaste: () => void;
  readonly onSelectSchema: (schemaId: KonsoleSchemaId) => void;
  readonly onAboutKonsole: () => void;
  readonly onAboutKde: () => void;
  readonly bookmarkEntries: readonly KonsoleBookmarksMenuEntry[];
  readonly onBookmarkAction: (action: KonsoleBookmarksMenuAction) => void;
};

const topMenus: readonly { readonly id: KonsoleTopMenuId; readonly labelKey: "konsole.session" | "konsole.edit" | "konsole.view" | "konsole.bookmarks" | "konsole.settings" | "konsole.help" }[] = [
  { id: "session", labelKey: "konsole.session" },
  { id: "edit", labelKey: "konsole.edit" },
  { id: "view", labelKey: "konsole.view" },
  { id: "bookmarks", labelKey: "konsole.bookmarks" },
  { id: "settings", labelKey: "konsole.settings" },
  { id: "help", labelKey: "konsole.help" },
];

const schemaLabelKeys: Readonly<Record<KonsoleSchemaId, TranslationKey>> = {
  "konsole-default": "konsole.schemaDefault",
  "linux-colors": "konsole.schemaLinuxColors",
  "green-on-black": "konsole.schemaGreenOnBlack",
  "white-on-black": "konsole.schemaWhiteOnBlack",
  "xterm-colors": "konsole.schemaXtermColors",
};

const fallbackScreenArea = { x: 0, y: 0, width: 1024, height: 768 };

const toPopupTrigger = (rect: Pick<DOMRect, "left" | "right" | "top" | "bottom">): KonsolePopupTrigger => ({
  left: rect.left,
  right: rect.right,
  top: rect.top,
  bottom: rect.bottom,
});

function KonsoleBookmarkSubmenu({ entry, onAction }: Readonly<{
  entry: Extract<KonsoleBookmarksMenuEntry, { type: "submenu" }>;
  onAction: (action: KonsoleBookmarksMenuAction) => void;
}>) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="konsole-bookmark-menu__submenu-wrap" onPointerLeave={() => setIsOpen(false)}>
      <button
        type="button"
        role="menuitem"
        className="konsole-menu-popup__submenu-trigger"
        data-konsole-bookmark-folder={entry.id}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onPointerEnter={() => setIsOpen(true)}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{entry.label}</span><span className="konsole-menu-popup__submenu-arrow" aria-hidden="true">&#9654;</span>
      </button>
      {isOpen ? (
        <div className="konsole-menu-popup konsole-bookmark-menu__submenu" role="menu" aria-label={`${entry.label} ${t("konsole.bookmarks").toLocaleLowerCase()}`}>
          <KonsoleBookmarksMenuEntries entries={entry.children} onAction={onAction} />
        </div>
      ) : null}
    </div>
  );
}

function KonsoleBookmarksMenuEntries({ entries, onAction }: Readonly<{
  entries: readonly KonsoleBookmarksMenuEntry[];
  onAction: (action: KonsoleBookmarksMenuAction) => void;
}>) {
  const { t } = useI18n();
  return entries.map((entry) => {
    if (entry.type === "separator") {
      return <div key={entry.id} className="konsole-menu-separator" role="separator" />;
    }
    if (entry.type === "submenu") {
      return <KonsoleBookmarkSubmenu key={entry.id} entry={entry} onAction={onAction} />;
    }
    return (
      <button
        key={entry.id}
        type="button"
        role="menuitem"
        data-konsole-menu-command={entry.action.type}
        data-konsole-bookmark-id={entry.action.type === "open-bookmark" ? entry.action.bookmarkId : undefined}
        onClick={() => onAction(entry.action)}
      >
        {entry.action.type === "add-bookmark"
          ? t("konsole.addBookmark")
          : entry.action.type === "edit-bookmarks"
            ? t("konsole.editBookmarks")
            : entry.action.type === "new-folder"
              ? t("konsole.newBookmarkFolder")
              : entry.label}
      </button>
    );
  });
}

export function KonsoleMenuBar({
  windowId,
  canCopy,
  canPaste,
  schemaId,
  onNewShell,
  onNewWindow,
  onRenameSession,
  onQuit,
  onCopy,
  onPaste,
  onSelectSchema,
  onAboutKonsole,
  onAboutKde,
  bookmarkEntries,
  onBookmarkAction,
}: KonsoleMenuBarProps) {
  const { t } = useI18n();
  const windowManager = useContext(WindowManagerContext);
  const popupLayer = useWindowOwnedPopupLayer();
  const menuBarRef = useRef<HTMLElement | null>(null);
  const menuPopupRef = useRef<HTMLDivElement | null>(null);
  const schemaPopupRef = useRef<HTMLDivElement | null>(null);
  const nextRequestIdRef = useRef(1);
  const [menuRequest, setMenuRequest] = useState<KonsoleMenuRequest | null>(null);
  const [schemaRequest, setSchemaRequest] = useState<KonsoleSchemaRequest | null>(null);
  const screenArea = windowManager?.screenArea ?? windowManager?.workArea ?? fallbackScreenArea;
  const closeMenus = useCallback(() => {
    setMenuRequest(null);
    setSchemaRequest(null);
  }, []);
  const resolveMenuPosition = useCallback((popup: HTMLElement, request: KonsoleMenuRequest) =>
    getApplicationMenuPopupPosition(
      request.trigger,
      (() => {
        const bounds = toLogicalRect(popup.getBoundingClientRect());
        return { width: bounds.width, height: bounds.height };
      })(),
      screenArea,
    ), [screenArea]);
  const { isPositioned: isMenuPositioned, position: menuPosition } = useMeasuredPopupPosition(
    menuRequest,
    menuPopupRef,
    resolveMenuPosition,
  );
  const resolveSchemaPosition = useCallback((popup: HTMLElement, request: KonsoleSchemaRequest) =>
    getKonsoleSchemaSubmenuPosition(
      request.trigger,
      (() => {
        const bounds = toLogicalRect(popup.getBoundingClientRect());
        return { width: bounds.width, height: bounds.height };
      })(),
      screenArea,
    ), [screenArea]);
  const { isPositioned: isSchemaPositioned, position: schemaPosition } = useMeasuredPopupPosition(
    schemaRequest,
    schemaPopupRef,
    resolveSchemaPosition,
  );

  useApplicationMenuDismissal({
    isOpen: menuRequest !== null || schemaRequest !== null,
    menuBarRef,
    popupRefs: [menuPopupRef, schemaPopupRef],
    onDismiss: closeMenus,
  });

  useEffect(() => {
    if (popupLayer?.dismissGeneration) {
      closeMenus();
    }
  }, [closeMenus, popupLayer?.dismissGeneration]);
  useApplicationMenubarPolicy(closeMenus, windowManager?.layoutMode ?? "desktop");

  const toggleMenu = (menu: KonsoleTopMenuId, trigger: Pick<DOMRect, "left" | "right" | "top" | "bottom">) => {
    if (menuRequest?.menu === menu) {
      closeMenus();
      return;
    }

    setMenuRequest({ menu, requestId: nextRequestIdRef.current++, trigger: toPopupTrigger(trigger) });
    setSchemaRequest(null);
  };

  const openSchema = (trigger: Pick<DOMRect, "left" | "right" | "top" | "bottom">) => {
    if (menuRequest?.menu !== "settings") {
      return;
    }

    setSchemaRequest({ requestId: nextRequestIdRef.current++, trigger: toPopupTrigger(trigger) });
  };

  const perform = (action: () => void) => {
    action();
    closeMenus();
  };

  const popup = menuRequest === null ? null : (
    <div
      ref={menuPopupRef}
      className={`konsole-menu-popup konsole-menu-popup--${menuRequest.menu}`}
      role="menu"
      aria-label={`${t(topMenus.find((menu) => menu.id === menuRequest.menu)?.labelKey ?? "konsole.session")} menu`}
      data-window-id={windowId}
      data-menu-request-id={menuRequest.requestId}
      data-positioned={isMenuPositioned}
      style={menuPosition ?? { visibility: "hidden", pointerEvents: "none" }}
    >
      {menuRequest.menu === "session" ? (
        <>
          <button type="button" role="menuitem" data-konsole-menu-command="new-shell" onClick={() => perform(onNewShell)}>{t("konsole.newShell")}</button>
          <button type="button" role="menuitem" data-konsole-menu-command="new-window" disabled={onNewWindow === undefined} onClick={() => perform(onNewWindow ?? (() => undefined))}>{t("konsole.newWindow")}</button>
          <div className="konsole-menu-separator" role="separator" />
          <button type="button" role="menuitem" data-konsole-menu-command="quit" onClick={() => perform(onQuit)}>{t("konsole.quit")}</button>
        </>
      ) : null}
      {menuRequest.menu === "view" ? (
        <button type="button" role="menuitem" data-konsole-menu-command="rename-session" onClick={() => perform(onRenameSession)}>{t("konsole.renameSession")}</button>
      ) : null}
      {menuRequest.menu === "edit" ? (
        <>
          <button type="button" role="menuitem" data-konsole-menu-command="copy" disabled={!canCopy} onClick={() => perform(onCopy)}>{t("konsole.copy")}</button>
          <button type="button" role="menuitem" data-konsole-menu-command="paste" disabled={!canPaste} onClick={() => perform(onPaste)}>{t("konsole.paste")}</button>
        </>
      ) : null}
      {menuRequest.menu === "bookmarks" ? (
        <KonsoleBookmarksMenuEntries entries={bookmarkEntries} onAction={(action) => perform(() => onBookmarkAction(action))} />
      ) : null}
      {menuRequest.menu === "settings" ? (
        <button
          type="button"
          role="menuitem"
          className="konsole-menu-popup__submenu-trigger"
          data-konsole-menu-command="schema"
          aria-haspopup="menu"
          aria-expanded={schemaRequest !== null}
          onPointerEnter={(event) => openSchema(toLogicalRect(event.currentTarget.getBoundingClientRect()))}
          onClick={(event) => openSchema(toLogicalRect(event.currentTarget.getBoundingClientRect()))}
        >
          <span>{t("konsole.schema")}</span><span className="konsole-menu-popup__submenu-arrow" aria-hidden="true">&#9654;</span>
        </button>
      ) : null}
      {menuRequest.menu === "help" ? (
        <>
          <button type="button" role="menuitem" data-konsole-menu-command="about-konsole" onClick={() => perform(onAboutKonsole)}>{t("konsole.aboutKonsole")}</button>
          <button type="button" role="menuitem" data-konsole-menu-command="about-kde" onClick={() => perform(onAboutKde)}>{t("konsole.aboutKde")}</button>
        </>
      ) : null}
    </div>
  );
  const schemaPopup = schemaRequest === null ? null : (
    <div
      ref={schemaPopupRef}
      className="konsole-menu-popup konsole-schema-menu"
      role="menu"
      aria-label={t("konsole.schemaMenu")}
      data-window-id={windowId}
      data-menu-request-id={schemaRequest.requestId}
      data-positioned={isSchemaPositioned}
      style={schemaPosition ?? { visibility: "hidden", pointerEvents: "none" }}
    >
      {konsoleSchemas.map((schema) => (
        <button
          key={schema.id}
          type="button"
          role="menuitemradio"
          data-konsole-schema={schema.id}
          aria-checked={schema.id === schemaId}
          onClick={() => perform(() => onSelectSchema(schema.id))}
        >
          <span className="konsole-menu-check" aria-hidden="true">{schema.id === schemaId ? "✓" : ""}</span>
          {t(schemaLabelKeys[schema.id])}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <nav ref={menuBarRef} className={`${APPLICATION_MENUBAR_CLASS} konsole-menubar kde-chrome-surface`} aria-label={t("konsole.menuBar")}>
        {topMenus.map((menu) => (
          <div key={menu.id} className="konsole-menu-root">
            <button
              type="button"
              className={`konsole-menuitem${menuRequest?.menu === menu.id ? " is-active" : ""}`}
              aria-haspopup="menu"
              aria-expanded={menuRequest?.menu === menu.id}
              onClick={(event) => toggleMenu(menu.id, toLogicalRect(event.currentTarget.getBoundingClientRect()))}
            >
              {t(menu.labelKey)}
            </button>
          </div>
        ))}
      </nav>
      <WindowOwnedPopupPortal>{popup}{schemaPopup}</WindowOwnedPopupPortal>
    </>
  );
}
