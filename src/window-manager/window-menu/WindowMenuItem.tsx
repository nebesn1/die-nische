import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { WindowMenuIcon } from "./WindowMenuIcon";
import type { WindowMenuExecutableEntry } from "./types";

type WindowMenuItemProps = {
  entry: WindowMenuExecutableEntry;
  isActive: boolean;
  isSubmenuOpen: boolean;
  onActivate: (entry: WindowMenuExecutableEntry) => void;
  onFocusItem: (entry: WindowMenuExecutableEntry) => void;
  onOpenSubmenu: (entry: WindowMenuExecutableEntry) => void;
  onCloseSubmenu: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
};

export function WindowMenuItem({
  children,
  entry,
  isActive,
  isSubmenuOpen,
  onActivate,
  onCloseSubmenu,
  onFocusItem,
  onKeyDown,
  onOpenSubmenu,
}: WindowMenuItemProps) {
  const isEnabled = entry.enabled;
  const isSubmenu = entry.type === "submenu";
  const isDesktop = entry.type === "desktop";
  const disabledClass = isEnabled ? "" : " is-disabled";
  const activeClass = isActive && isEnabled ? " is-active" : "";
  const currentClass = isDesktop && entry.isCurrent ? " is-current" : "";

  const handleMouseEnter = () => {
    if (isEnabled) {
      onFocusItem(entry);
    }

    if (isEnabled && isSubmenu) {
      onOpenSubmenu(entry);
      return;
    }

    if (!isDesktop) {
      onCloseSubmenu();
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!isEnabled) {
      return;
    }

    onActivate(entry);
  };

  return (
    <li className={`window-menu-item-shell${disabledClass}`} onMouseEnter={handleMouseEnter}>
      <button
        type="button"
        className={`window-menu-item${activeClass}${disabledClass}${currentClass}`}
        role={isDesktop ? "menuitemradio" : "menuitem"}
        aria-checked={isDesktop ? entry.isCurrent : undefined}
        aria-disabled={isEnabled ? undefined : true}
        aria-haspopup={isSubmenu ? "menu" : undefined}
        aria-expanded={isSubmenu ? isSubmenuOpen : undefined}
        data-window-menu-item-id={entry.id}
        tabIndex={isActive && isEnabled ? 0 : -1}
        title={!isEnabled && entry.type === "command" ? entry.disabledReason : undefined}
        onClick={handleClick}
        onKeyDown={onKeyDown}
      >
        <span className="window-menu-item__check" aria-hidden="true">
        </span>
        <span className="window-menu-item__icon" aria-hidden="true">
          {entry.type === "desktop" ? null : (
            <WindowMenuIcon iconId={entry.iconId} aria-hidden="true" focusable="false" />
          )}
        </span>
        <span className="window-menu-item__label">{entry.label}</span>
        {isSubmenu ? <span className="window-menu-item__arrow" aria-hidden="true" /> : null}
      </button>
      {children}
    </li>
  );
}
