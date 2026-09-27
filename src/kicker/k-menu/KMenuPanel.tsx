import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { LaunchApplicationOptions } from "../../application-runtime/types";
import { getApplicationDefinition } from "../../application-runtime/applicationRegistry";
import { WindowManagerContext } from "../../window-manager/useWindowManager";
import type { ScreenArea } from "../../window-manager/types";
import { kMenuEntries } from "./menuModel";
import { getFirstEnabledItemId, getLastEnabledItemId, getNextEnabledItemId } from "./menuState";
import { KMenuItem } from "./KMenuItem";
import { KMenuSeparator } from "./KMenuSeparator";
import { getKMenuSubmenuPosition, type KMenuSubmenuPosition } from "./submenuPosition";
import type { KMenuEntry, KMenuExecutableEntry, KMenuState, KMenuSubmenu } from "./types";
import { getLogicalViewportSize, toLogicalRect } from "../../desktop/desktopUiScale";
import { useI18n } from "../../i18n/useI18n";

type KMenuPanelProps = {
  menuId: string;
  entries?: readonly KMenuEntry[];
  state: KMenuState;
  onSetActiveItem: (itemId: string | null) => void;
  onOpenSubmenu: (entry: KMenuSubmenu) => void;
  onCloseSubmenu: () => void;
  onCloseMenu: (returnFocus: boolean) => void;
  onLaunchApplication: (appId: string, options?: LaunchApplicationOptions) => void;
  onLaunchNewApplicationInstance?: (appId: string, options?: LaunchApplicationOptions) => void;
  onExecuteCommand?: (entry: Extract<KMenuEntry, { type: "command" }>) => void;
  popupClassName?: string;
  popupStyle?: CSSProperties;
  panelClassName?: string;
  panelRef?: (element: HTMLElement | null) => void;
  submenuBounds?: ScreenArea;
  showBrand?: boolean;
  ariaLabel?: string;
  menuVariant?: "k-menu" | "context";
  selectFirstSubmenuItem?: boolean;
  labelOverrides?: Readonly<Record<string, string>>;
};

const getEnabledChildren = (entry: KMenuEntry): readonly KMenuEntry[] => {
  return entry.type === "submenu" ? entry.children : [];
};

const findParentSubmenu = (
  activeItemId: string | null,
  entries: readonly KMenuEntry[],
): KMenuEntry | undefined => {
  if (!activeItemId) {
    return undefined;
  }

  for (const entry of entries) {
    if (entry.type !== "submenu" || !entry.enabled) {
      continue;
    }

    if (entry.children.some((child) => child.id === activeItemId)) {
      return entry;
    }

    const nested = findParentSubmenu(activeItemId, entry.children);
    if (nested) {
      return nested;
    }
  }

  return undefined;
};

const containsSubmenuId = (entry: KMenuEntry, submenuId: string | null): boolean => entry.type === "submenu" && (
  entry.id === submenuId || entry.children.some((child) => containsSubmenuId(child, submenuId))
);

type PositionedSubmenuProps = {
  readonly entry: KMenuSubmenu;
  readonly menuRoot: HTMLElement | null;
  readonly workArea: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly layoutRevision: string;
  readonly showBack: boolean;
  readonly onBack: () => void;
  readonly children: (layoutRevision: string) => ReactNode;
};

function PositionedSubmenu({ children, entry, layoutRevision, menuRoot, onBack, showBack, workArea }: PositionedSubmenuProps) {
  const { t } = useI18n();
  const submenuRef = useRef<HTMLUListElement | null>(null);
  const [position, setPosition] = useState<KMenuSubmenuPosition | null>(null);

  const positionSubmenu = useCallback(() => {
    const submenu = submenuRef.current;
    const trigger = [...(menuRoot?.querySelectorAll<HTMLButtonElement>("[data-menu-item-id]") ?? [])]
      .find((item) => item.dataset.menuItemId === entry.id);

    if (!submenu || !trigger) {
      return;
    }

    const triggerRect = toLogicalRect(trigger.getBoundingClientRect());
    const submenuRect = toLogicalRect(submenu.getBoundingClientRect());
    setPosition(getKMenuSubmenuPosition(
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
    window.addEventListener("scroll", positionSubmenu, true);
    return () => {
      window.removeEventListener("resize", positionSubmenu);
      window.removeEventListener("scroll", positionSubmenu, true);
    };
  }, [positionSubmenu]);

  const childLayoutRevision = position === null
    ? layoutRevision
    : `${layoutRevision}:${position.left}:${position.top}:${position.maxHeight}`;

  return (
    <ul
      ref={submenuRef}
      className={`k-menu-submenu${position === null ? "" : " is-positioned"}`}
      role="menu"
      aria-label={t("common.submenu", { name: entry.label })}
      data-k-menu-submenu-id={entry.id}
      style={position === null ? undefined : {
        left: `${position.left}px`,
        top: `${position.top}px`,
        maxHeight: `${position.maxHeight}px`,
      }}
    >
      {showBack ? (
        <li className="k-menu-back-shell">
          <button
            type="button"
            className="k-menu-back"
            data-k-menu-back={entry.id}
            onClick={(event) => {
              event.preventDefault();
              onBack();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onBack();
              }
            }}
          >
            <span className="k-menu-back__arrow" aria-hidden="true" />
            <span>{t("konqueror.menu.back")}</span>
          </button>
        </li>
      ) : null}
      {children(childLayoutRevision)}
    </ul>
  );
}

export function KMenuPanel({
  entries = kMenuEntries,
  menuId,
  onCloseMenu,
  onCloseSubmenu,
  onExecuteCommand = () => undefined,
  onLaunchApplication,
  onLaunchNewApplicationInstance,
  onOpenSubmenu,
  onSetActiveItem,
  ariaLabel = "K menu",
  panelClassName = "k-menu-panel",
  panelRef,
  popupClassName = "panel-popup-layer k-menu-popup",
  popupStyle,
  submenuBounds,
  showBrand = true,
  state,
  menuVariant = "k-menu",
  selectFirstSubmenuItem = true,
  labelOverrides,
}: KMenuPanelProps) {
  const windowManager = useContext(WindowManagerContext);
  const layoutMode = windowManager?.layoutMode ?? "desktop";
  const [menuRoot, setMenuRoot] = useState<HTMLElement | null>(null);
  const handlePanelRef = useCallback((element: HTMLElement | null) => {
    setMenuRoot(element);
    panelRef?.(element);
  }, [panelRef]);
  const fallbackWorkArea = useMemo(() => ({
    x: 0,
    y: 0,
    ...(typeof window === "undefined" ? { width: 0, height: 0 } : getLogicalViewportSize()),
  }), []);
  const workArea = submenuBounds ?? windowManager?.workArea ?? fallbackWorkArea;
  const executeEntry = (entry: KMenuExecutableEntry) => {
    if (!entry.enabled) {
      return;
    }

    if (entry.type === "application" && getApplicationDefinition(entry.appId)) {
      const launch = entry.newInstance ? onLaunchNewApplicationInstance ?? onLaunchApplication : onLaunchApplication;
      launch(entry.appId, entry.launchIntent === undefined ? undefined : { intent: entry.launchIntent });
      onCloseMenu(false);
      return;
    }

    if (entry.type === "command") {
      onExecuteCommand(entry);
      return;
    }

    if (entry.type === "submenu") {
      onOpenSubmenu(entry);
      onSetActiveItem(selectFirstSubmenuItem ? getFirstEnabledItemId(entry.children) : null);
    }
  };

  const findSubmenu = (submenuId: string | null, candidates: readonly KMenuEntry[]): KMenuSubmenu | undefined => {
    if (!submenuId) {
      return undefined;
    }

    for (const candidate of candidates) {
      if (candidate.type !== "submenu" || !candidate.enabled) {
        continue;
      }

      if (candidate.id === submenuId) {
        return candidate;
      }

      const nested = findSubmenu(submenuId, candidate.children);
      if (nested) {
        return nested;
      }
    }

    return undefined;
  };

  const goBackFromSubmenu = (submenuId: string) => {
    const parentSubmenu = findParentSubmenu(submenuId, entries);

    onCloseSubmenu();
    if (parentSubmenu?.type === "submenu") {
      onOpenSubmenu(parentSubmenu);
      onSetActiveItem(parentSubmenu.id);
      return;
    }

    onSetActiveItem(null);
  };

  const handleItemKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const parentSubmenu = findParentSubmenu(state.activeItemId, entries);
    const openSubmenu = findSubmenu(state.openSubmenuId, entries);
    const activeEntries = parentSubmenu
      ? getEnabledChildren(parentSubmenu)
      : openSubmenu
        ? getEnabledChildren(openSubmenu)
        : entries;
    const activeEntry = state.activeItemId
      ? [...activeEntries].find((entry) => entry.id === state.activeItemId)
      : undefined;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      onSetActiveItem(
        getNextEnabledItemId(activeEntries, state.activeItemId, event.key === "ArrowDown" ? "next" : "previous"),
      );
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onSetActiveItem(event.key === "Home" ? getFirstEnabledItemId(activeEntries) : getLastEnabledItemId(activeEntries));
      return;
    }

    if (event.key === "ArrowRight" && activeEntry?.type === "submenu" && activeEntry.enabled) {
      event.preventDefault();
      onOpenSubmenu(activeEntry);
      onSetActiveItem(selectFirstSubmenuItem ? getFirstEnabledItemId(activeEntry.children) : null);
      return;
    }

    if (event.key === "ArrowLeft" && parentSubmenu) {
      event.preventDefault();
      onCloseSubmenu();
      onSetActiveItem(parentSubmenu.id);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (
        activeEntry &&
        (activeEntry.type === "application" || activeEntry.type === "submenu" || activeEntry.type === "command")
      ) {
        executeEntry(activeEntry);
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCloseMenu(true);
    }
  };

  const renderEntry = (entry: KMenuEntry, isRootEntry: boolean, layoutRevision = "root"): ReactNode => {
    if (entry.type === "separator") {
      return <KMenuSeparator key={entry.id} entry={entry} variant={menuVariant} />;
    }

    if (entry.type === "section") {
      return <li key={entry.id} className="k-menu-section" role="presentation" data-menu-section-id={entry.id}>{entry.label}</li>;
    }

    const isSubmenuOpen = entry.type === "submenu" && entry.enabled && containsSubmenuId(entry, state.openSubmenuId);
    const displayEntry = labelOverrides?.[entry.id] === undefined
      ? entry
      : { ...entry, label: labelOverrides[entry.id] };

    return (
      <KMenuItem
        key={displayEntry.id}
        entry={displayEntry}
        isActive={state.activeItemId === entry.id || (menuVariant === "context" && state.openSubmenuId === entry.id)}
        isSubmenuOpen={isSubmenuOpen}
        onActivate={executeEntry}
        onFocusItem={(focusedEntry) => onSetActiveItem(focusedEntry.id)}
        onOpenSubmenu={(submenuEntry) => submenuEntry.type === "submenu" && onOpenSubmenu(submenuEntry)}
        onCloseSubmenu={isRootEntry ? onCloseSubmenu : () => undefined}
      >
        {isSubmenuOpen ? (
          <PositionedSubmenu
            entry={displayEntry as KMenuSubmenu}
            menuRoot={menuRoot}
            workArea={workArea}
            layoutRevision={layoutRevision}
            showBack={layoutMode === "mobile" && !isRootEntry}
            onBack={() => goBackFromSubmenu(entry.id)}
          >
            {(childLayoutRevision) => entry.children.map((childEntry) => renderEntry(childEntry, false, childLayoutRevision))}
          </PositionedSubmenu>
        ) : null}
      </KMenuItem>
    );
  };

  return (
    <div className={`${popupClassName}${menuVariant === "context" ? " k-menu-popup--context" : ""}`} style={popupStyle}>
      <nav ref={handlePanelRef} id={menuId} className={panelClassName} role="menu" aria-label={ariaLabel} tabIndex={-1} onKeyDown={handleItemKeyDown}>
        {showBrand ? <div className="k-menu-brand" aria-hidden="true"><span>KDE 3</span></div> : null}
        <ul className="k-menu-list">{entries.map((entry) => renderEntry(entry, true))}</ul>
      </nav>
    </div>
  );
}
