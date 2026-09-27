import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { getSubmenuPosition, type SubmenuPosition } from "../../desktop/submenuPosition";
import { useWindowManager } from "../useWindowManager";
import { useApplicationRuntime } from "../../application-runtime/ApplicationRuntimeContext";
import { useWindowMenu } from "./useWindowMenu";
import { findWindowMenuEntry } from "./windowMenuModel";
import { WindowMenuItem } from "./WindowMenuItem";
import { WindowMenuSeparator } from "./WindowMenuSeparator";
import {
  getFirstEnabledWindowMenuItemId,
  getLastEnabledWindowMenuItemId,
  getNextEnabledWindowMenuItemId,
} from "./windowMenuState";
import type { WindowMenuEntry, WindowMenuExecutableEntry, WindowMenuPanelProps, WindowMenuSubmenuEntry } from "./types";
import { toLogicalRect } from "../../desktop/desktopUiScale";
import { useI18n } from "../../i18n/useI18n";

const findParentSubmenu = (
  activeItemId: string | null,
  entries: readonly WindowMenuEntry[],
): WindowMenuEntry | undefined => {
  if (!activeItemId) {
    return undefined;
  }

  return entries.find((entry) => entry.type === "submenu" && entry.children.some((child) => child.id === activeItemId));
};

const getChildren = (entry: WindowMenuEntry | undefined): readonly WindowMenuEntry[] => {
  return entry?.type === "submenu" ? entry.children : [];
};

type PositionedWindowSubmenuProps = {
  entry: WindowMenuSubmenuEntry;
  layoutRevision: string;
  menuRoot: HTMLElement | null;
  workArea: { x: number; y: number; width: number; height: number };
  children: ReactNode;
};

function PositionedWindowSubmenu({ children, entry, layoutRevision, menuRoot, workArea }: PositionedWindowSubmenuProps) {
  const { t } = useI18n();
  const submenuRef = useRef<HTMLUListElement | null>(null);
  const [position, setPosition] = useState<SubmenuPosition | null>(null);

  const positionSubmenu = useCallback(() => {
    const submenu = submenuRef.current;
    const trigger = [...(menuRoot?.querySelectorAll<HTMLButtonElement>("[data-window-menu-item-id]") ?? [])]
      .find((item) => item.dataset.windowMenuItemId === entry.id);

    if (!submenu || !trigger) {
      return;
    }

    const triggerRect = toLogicalRect(trigger.getBoundingClientRect());
    const submenuRect = toLogicalRect(submenu.getBoundingClientRect());
    setPosition(getSubmenuPosition(
      { left: triggerRect.left, right: triggerRect.right, top: triggerRect.top },
      { width: submenuRect.width, height: submenuRect.height },
      workArea,
    ));
  }, [entry.id, menuRoot, workArea]);

  useLayoutEffect(() => {
    positionSubmenu();
  }, [layoutRevision, positionSubmenu]);

  useEffect(() => {
    window.addEventListener("resize", positionSubmenu);
    return () => window.removeEventListener("resize", positionSubmenu);
  }, [positionSubmenu]);

  return (
    <ul
      ref={submenuRef}
      className={`window-menu-submenu${position === null ? "" : " is-positioned"}`}
      role="menu"
      aria-label={t("common.submenu", { name: entry.label })}
      data-window-menu-submenu-id={entry.id}
      style={position === null ? undefined : {
        left: `${position.left}px`,
        top: `${position.top}px`,
        maxHeight: `${position.maxHeight}px`,
      }}
    >
      {children}
    </ul>
  );
}

export function WindowMenuPanel({ desktopWindow, entries, menuId, position }: WindowMenuPanelProps) {
  const { t } = useI18n();
  const {
    minimizeWindow,
    moveWindowToDesktop,
    screenArea,
    toggleMaximizeWindow,
    workArea,
  } = useWindowManager();
  const [menuRoot, setMenuRoot] = useState<HTMLElement | null>(null);
  const applicationRuntime = useApplicationRuntime();
  const { closeSubmenu, closeWindowMenu, openSubmenu, setActiveItem, state } = useWindowMenu();

  const localizeEntry = (entry: WindowMenuEntry): WindowMenuEntry => {
    if (entry.type === "submenu") {
      return { ...entry, label: t("windowMenu.toDesktop"), children: entry.children.map((child) => ({ ...child, label: t("common.desktopNumber", { number: child.desktopId }) })) };
    }

    if (entry.type === "command") {
      return { ...entry, label: entry.id === "minimize" ? t("windowMenu.minimize") : entry.id === "maximize" ? t("windowMenu.maximize") : t("windowMenu.close") };
    }

    return entry;
  };

  const executeEntry = (entry: WindowMenuExecutableEntry) => {
    if (!entry.enabled) {
      return;
    }

    if (entry.type === "submenu") {
      openSubmenu(entry.id);
      setActiveItem(getFirstEnabledWindowMenuItemId(entry.children));
      return;
    }

    if (entry.type === "desktop") {
      moveWindowToDesktop(desktopWindow.id, entry.desktopId);
      closeWindowMenu(false);
      return;
    }

    if (entry.id === "minimize") {
      minimizeWindow(desktopWindow.id);
      closeWindowMenu(false);
      return;
    }

    if (entry.id === "maximize") {
      toggleMaximizeWindow(desktopWindow.id);
      closeWindowMenu(false);
      return;
    }

    if (entry.id === "close") {
      if (applicationRuntime) {
        applicationRuntime.requestWindowClose(desktopWindow.id);
      }
      closeWindowMenu(false);
    }
  };

  const handleItemKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const parentSubmenu = findParentSubmenu(state.activeItemId, entries);
    const activeEntries = parentSubmenu ? getChildren(parentSubmenu) : entries;
    const activeEntry = state.activeItemId ? findWindowMenuEntry(activeEntries, state.activeItemId) : undefined;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveItem(
        getNextEnabledWindowMenuItemId(activeEntries, state.activeItemId, event.key === "ArrowDown" ? "next" : "previous"),
      );
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveItem(event.key === "Home" ? getFirstEnabledWindowMenuItemId(activeEntries) : getLastEnabledWindowMenuItemId(activeEntries));
      return;
    }

    if (event.key === "ArrowRight" && activeEntry?.type === "submenu" && activeEntry.enabled) {
      event.preventDefault();
      openSubmenu(activeEntry.id);
      setActiveItem(getFirstEnabledWindowMenuItemId(activeEntry.children));
      return;
    }

    if (event.key === "ArrowLeft" && parentSubmenu) {
      event.preventDefault();
      closeSubmenu();
      setActiveItem(parentSubmenu.id);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (activeEntry && activeEntry.type !== "separator") {
        executeEntry(activeEntry);
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeWindowMenu(true);
    }
  };

  const renderEntry = (entry: WindowMenuEntry, isRootEntry: boolean): ReactNode => {
    if (entry.type === "separator") {
      return <WindowMenuSeparator key={entry.id} entry={entry} />;
    }

    const isSubmenuOpen = entry.type === "submenu" && state.openSubmenuId === entry.id;
    const displayEntry = localizeEntry(entry);

    return (
      <WindowMenuItem
        key={entry.id}
        entry={displayEntry as Extract<WindowMenuEntry, { type: "submenu" | "command" | "desktop" }>}
        isActive={state.activeItemId === entry.id}
        isSubmenuOpen={isSubmenuOpen}
        onActivate={executeEntry}
        onFocusItem={(focusedEntry) => setActiveItem(focusedEntry.id)}
        onOpenSubmenu={(submenuEntry) => submenuEntry.type === "submenu" && openSubmenu(submenuEntry.id)}
        onCloseSubmenu={isRootEntry ? closeSubmenu : () => undefined}
        onKeyDown={handleItemKeyDown}
      >
        {isSubmenuOpen ? (
          <PositionedWindowSubmenu
            entry={displayEntry as Extract<WindowMenuEntry, { type: "submenu" }>}
            layoutRevision={`${entry.id}:${entry.children.length}`}
            menuRoot={menuRoot}
            workArea={screenArea ?? workArea}
          >
            {entry.children.map((childEntry) => renderEntry(childEntry, false))}
          </PositionedWindowSubmenu>
        ) : null}
      </WindowMenuItem>
    );
  };

  return (
    <nav
      id={menuId}
      className="window-menu-panel"
      role="menu"
      aria-label={t("windowMenu.for", { title: desktopWindow.title })}
      data-window-menu
      ref={setMenuRoot}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <ul className="window-menu-list">{entries.map((entry) => renderEntry(entry, true))}</ul>
    </nav>
  );
}
