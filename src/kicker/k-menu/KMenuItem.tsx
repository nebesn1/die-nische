import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { KMenuEntryIcon } from "./KMenuIcon";
import type { KMenuExecutableEntry } from "./types";
import { isTouchLikePointer, TOUCH_LONG_PRESS_MOVE_TOLERANCE } from "../../input/pointerInteraction";

type KMenuItemProps = {
  entry: KMenuExecutableEntry;
  isActive: boolean;
  isSubmenuOpen: boolean;
  onActivate: (entry: KMenuExecutableEntry) => void;
  onFocusItem: (entry: KMenuExecutableEntry) => void;
  onOpenSubmenu: (entry: KMenuExecutableEntry) => void;
  onCloseSubmenu: () => void;
  children?: ReactNode;
};

export function KMenuItem({
  children,
  entry,
  isActive,
  isSubmenuOpen,
  onActivate,
  onCloseSubmenu,
  onFocusItem,
  onOpenSubmenu,
}: KMenuItemProps) {
  const isSubmenu = entry.type === "submenu";
  const isEnabled = entry.enabled;
  const stateClass = isActive && isEnabled ? " is-active" : "";
  const disabledClass = isEnabled ? "" : " is-disabled";
  const touchPointerRef = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null);
  const touchMovedRef = useRef(false);
  const touchInteractionRef = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isTouchLikePointer(event.pointerType)) {
      return;
    }

    if (touchPointerRef.current && touchPointerRef.current.pointerId !== event.pointerId) {
      touchPointerRef.current = null;
      touchMovedRef.current = true;
    }

    touchPointerRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
    touchMovedRef.current = false;
    touchInteractionRef.current = true;
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const pointer = touchPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) {
      return;
    }

    if (Math.hypot(event.clientX - pointer.clientX, event.clientY - pointer.clientY) > TOUCH_LONG_PRESS_MOVE_TOLERANCE) {
      touchMovedRef.current = true;
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (touchPointerRef.current?.pointerId === event.pointerId) {
      touchPointerRef.current = null;
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (touchPointerRef.current?.pointerId === event.pointerId) {
      touchPointerRef.current = null;
      touchMovedRef.current = true;
    }
    touchInteractionRef.current = false;
  };

  const handleMouseEnter = () => {
    if (touchInteractionRef.current) {
      return;
    }

    if (isEnabled) {
      onFocusItem(entry);
    }

    if (isEnabled && isSubmenu) {
      onOpenSubmenu(entry);
    } else {
      onCloseSubmenu();
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (touchMovedRef.current) {
      touchMovedRef.current = false;
      touchInteractionRef.current = false;
      return;
    }

    touchInteractionRef.current = false;

    if (!isEnabled) {
      return;
    }

    onActivate(entry);
  };

  return (
    <li className={`k-menu-item-shell${disabledClass}`} onMouseEnter={handleMouseEnter}>
      <button
        type="button"
        className={`k-menu-item${stateClass}${disabledClass}`}
        role="menuitem"
        disabled={!isEnabled}
        aria-disabled={isEnabled ? undefined : true}
        aria-haspopup={isSubmenu && isEnabled ? "menu" : undefined}
        aria-expanded={isSubmenu && isEnabled ? isSubmenuOpen : undefined}
        data-menu-item-id={entry.id}
        tabIndex={isActive && isEnabled ? 0 : -1}
        title={!isEnabled ? entry.disabledReason : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
      >
        <span className="k-menu-item__icon" data-k-menu-icon-id={entry.iconId} aria-hidden="true">
          <KMenuEntryIcon iconId={entry.iconId} aria-hidden="true" focusable="false" />
        </span>
        <span className="k-menu-item__label">{entry.label}</span>
        {isSubmenu ? <span className="k-menu-item__arrow" aria-hidden="true" /> : null}
      </button>
      {children}
    </li>
  );
}
