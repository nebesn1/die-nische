import { forwardRef, useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import type { DesktopIconDefinition } from "./desktopIconTypes";
import { useI18n } from "../i18n/useI18n";
import { isTouchLikePointer, useLongPress } from "../input/pointerInteraction";

type DesktopIconProps = {
  definition: DesktopIconDefinition;
  icon: ReactNode;
  trashState?: "empty" | "full" | null;
  selected: boolean;
  isDropTarget?: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onNavigate: (id: string, direction: "next" | "previous") => void;
  onClearSelection: () => void;
  onOpenContextMenu: (id: string, clientX: number, clientY: number) => void;
};

export const DesktopIcon = forwardRef<HTMLButtonElement, DesktopIconProps>(function DesktopIcon(
  { definition, icon, isDropTarget = false, onClearSelection, onNavigate, onOpen, onOpenContextMenu, onSelect, selected, trashState = null },
  ref,
) {
  const { t } = useI18n();
  const lastPointerTypeRef = useRef<string>("mouse");
  const touchTapArmedRef = useRef(false);
  const lastTouchInteractionAtRef = useRef(0);
  useEffect(() => {
    if (!selected) {
      touchTapArmedRef.current = false;
    }
  }, [selected]);
  const label = definition.id === "desktop-trash"
    ? t("desktop.trash")
    : definition.id === "desktop-my-computer"
      ? t("desktop.myComputer")
      : definition.id === "desktop-blog"
        ? t("desktop.blog")
        : definition.id === "desktop-about-die-nische"
          ? t("desktop.about")
        : definition.label;
  const labelLines = definition.labelLines ? definition.labelLines.map((line) => line === definition.label ? label : line) : [label];

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSelect(definition.id);
      onOpen(definition.id);
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      onSelect(definition.id);
      onOpen(definition.id);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      onNavigate(definition.id, event.key === "ArrowDown" ? "next" : "previous");
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClearSelection();
    }
  };

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    if (longPress.consumeNativeContextMenu()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelect(definition.id);
    onOpenContextMenu(definition.id, event.clientX, event.clientY);
  };

  const longPress = useLongPress<HTMLButtonElement>({
    onLongPress: ({ clientX, clientY }) => {
      touchTapArmedRef.current = false;
      onSelect(definition.id);
      onOpenContextMenu(definition.id, clientX, clientY);
    },
  });

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    lastPointerTypeRef.current = event.pointerType;
    if (isTouchLikePointer(event.pointerType)) {
      longPress.onPointerDown(event);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (isTouchLikePointer(event.pointerType)) {
      longPress.onPointerMove(event);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (isTouchLikePointer(event.pointerType)) {
      longPress.onPointerUp(event);
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (isTouchLikePointer(event.pointerType)) {
      touchTapArmedRef.current = false;
      longPress.onPointerCancel(event);
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (longPress.consumeClick(event)) {
      return;
    }

    if (isTouchLikePointer(lastPointerTypeRef.current)) {
      lastTouchInteractionAtRef.current = Date.now();

      if (!touchTapArmedRef.current) {
        touchTapArmedRef.current = true;
        onSelect(definition.id);
        return;
      }

      touchTapArmedRef.current = false;
      onSelect(definition.id);
      onOpen(definition.id);
      return;
    }

    onSelect(definition.id);
  };

  const handleDoubleClick = () => {
    if (isTouchLikePointer(lastPointerTypeRef.current) && Date.now() - lastTouchInteractionAtRef.current < 750) {
      return;
    }

    onSelect(definition.id);
    onOpen(definition.id);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`desktop-icon${selected ? " is-selected" : ""}${isDropTarget ? " is-drop-target" : ""}`}
      aria-label={label}
      aria-pressed={selected}
      aria-description={definition.action.type === "placeholder" ? definition.action.disabledReason : undefined}
      data-desktop-icon="true"
      data-desktop-icon-id={definition.id}
      data-trash-state={trashState ?? undefined}
      title={definition.action.type === "placeholder" ? definition.action.disabledReason : undefined}
      style={{
        gridColumn: definition.initialColumn,
        gridRow: definition.initialRow,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={longPress.onLostPointerCapture}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
    >
      <span className="desktop-icon__art" aria-hidden="true">
        {icon}
      </span>
      <span className="desktop-icon__label" aria-hidden="true">
        {labelLines.map((line, index) => (
          <span className="desktop-icon__label-line" key={`${line}-${index}`}>
            {line}
          </span>
        ))}
      </span>
    </button>
  );
});
