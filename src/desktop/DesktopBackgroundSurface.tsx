import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { useI18n } from "../i18n/useI18n";
import { isPrimaryPointerEvent, useLongPress } from "../input/pointerInteraction";

type DesktopBackgroundSurfaceProps = {
  readonly onClearSelection: () => void;
  readonly onOpenContextMenu: (clientX: number, clientY: number) => void;
  readonly marqueeStyle?: CSSProperties | null;
  readonly onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
  readonly onLostPointerCapture?: (event: PointerEvent<HTMLElement>) => void;
  readonly onMarqueeClick?: (event: MouseEvent<HTMLElement>) => void;
};

export function DesktopBackgroundSurface({
  onClearSelection,
  onOpenContextMenu,
  marqueeStyle = null,
  onLostPointerCapture,
  onMarqueeClick,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: DesktopBackgroundSurfaceProps) {
  const { t } = useI18n();
  const longPress = useLongPress<HTMLElement>({
    onLongPress: ({ clientX, clientY }) => {
      onClearSelection();
      onOpenContextMenu(clientX, clientY);
    },
  });

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    longPress.onPointerDown(event);

    if (onPointerDown) {
      onPointerDown(event);
    } else if (isPrimaryPointerEvent(event)) {
      onClearSelection();
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    longPress.onPointerMove(event);
    onPointerMove?.(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    longPress.onPointerUp(event);
    onPointerUp?.(event);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    longPress.onPointerCancel(event);
    onPointerCancel?.(event);
  };

  const handleLostPointerCapture = (event: PointerEvent<HTMLElement>) => {
    longPress.onLostPointerCapture(event);
    onLostPointerCapture?.(event);
  };

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (longPress.consumeClick(event)) {
      return;
    }

    onMarqueeClick?.(event);
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (longPress.consumeNativeContextMenu()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    onClearSelection();
    onOpenContextMenu(event.clientX, event.clientY);
  };

  return (
    <section
      className="desktop-background-surface"
      aria-label={t("desktop.background")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {marqueeStyle ? <div className="desktop-selection-marquee" aria-hidden="true" style={marqueeStyle} /> : null}
    </section>
  );
}
