import type { PointerEvent } from "react";
import { useI18n } from "../i18n/useI18n";

const controls = [
  {
    id: "minimize",
    glyph: <path className="window-control__minimize-line" d="M2 7h7" />,
  },
  {
    id: "maximize",
  },
  {
    id: "close",
    glyph: <path d="M2 2l7 7M9 2L2 9" />,
  },
] as const;

type WindowControlsProps = {
  title: string;
  isMaximized: boolean;
  isMinimizable: boolean;
  isMinimizeDisabled?: boolean;
  isMaximizable: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
};

function MaximizeGlyph({ isMaximized }: { isMaximized: boolean }) {
  if (isMaximized) {
    return (
      <>
        <g className="window-control__restore-kde">
          <rect x="1.5" y="1.5" width="6" height="6" fill="none" />
          <rect x="4.5" y="4.5" width="6" height="6" fill="none" />
        </g>
        <g className="window-control__restore-redmond">
          <rect x="1.5" y="3.5" width="6" height="6" fill="none" />
          <path d="M3.5 1.5h6v6M3.5 3.5h4" fill="none" />
        </g>
      </>
    );
  }

  return <rect x="2" y="2" width="7" height="7" fill="none" />;
}

export function WindowControls({ title, isMaximized, isMinimizable, isMinimizeDisabled = false, isMaximizable, onMinimize, onToggleMaximize, onClose }: WindowControlsProps) {
  const { t } = useI18n();
  const stopPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const getClickHandler = (controlId: (typeof controls)[number]["id"]) => {
    if (controlId === "minimize") {
      return onMinimize;
    }

    if (controlId === "maximize") {
      return onToggleMaximize;
    }

    return onClose;
  };

  return (
    <div className="window-controls" aria-label={t("window.controls")} data-window-control onPointerDown={stopPointerDown}>
      {controls.filter((control) => control.id !== "minimize" || isMinimizable).map((control) => (
        <button
          key={control.id}
          type="button"
          className={`window-control window-control--${control.id}`}
          aria-label={control.id === "minimize"
            ? t("window.minimizeFor", { title })
            : control.id === "maximize"
              ? t(isMaximized ? "window.restoreFor" : "window.maximizeFor", { title })
              : t("window.closeFor", { title })}
          data-window-control
          data-window-action={control.id}
          disabled={control.id === "maximize" ? !isMaximizable : control.id === "minimize" ? isMinimizeDisabled : false}
          onClick={(control.id === "maximize" && !isMaximizable) || (control.id === "minimize" && isMinimizeDisabled) ? undefined : getClickHandler(control.id)}
        >
          <svg className="window-control__glyph" viewBox="0 0 11 11" aria-hidden="true" focusable="false">
            <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
              {control.id === "maximize" ? <MaximizeGlyph isMaximized={isMaximized} /> : control.glyph}
              {control.id === "minimize" ? <rect className="window-control__minimize-square" x="3.5" y="3.5" width="4" height="4" fill="currentColor" stroke="none" /> : null}
            </g>
          </svg>
        </button>
      ))}
    </div>
  );
}
