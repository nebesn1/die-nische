import { useContext, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { type DigitValue } from "./segmentMap";
import { getClockParts } from "./timeFormat";
import { SevenSegmentDigit } from "./SevenSegmentDigit";
import { useDesktopPreferences } from "../../preferences/useDesktopPreferences";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { WindowManagerContext } from "../../window-manager/useWindowManager";
import { getClockAnchoredCalendarBounds } from "../../apps/calendar/calendarWindow";
import { closeShellPopups } from "../../shell/shellPopupEvents";
import { ClockContextMenu } from "./ClockContextMenu";
import type { ClockContextMenuState } from "./clockContextMenuPosition";
import { toLogicalCoordinate, toLogicalRect } from "../../desktop/desktopUiScale";
import { useI18n } from "../../i18n/useI18n";

const toDigitValue = (value: string): DigitValue => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) {
    throw new Error(`Invalid digit value: ${value}`);
  }

  return parsed as DigitValue;
};

function Colon({ lit, visible = true, x }: { lit: boolean; visible?: boolean; x: number }) {
  return (
    <g fill={lit ? "var(--kde-clock-lit)" : "var(--kde-clock-dim)"} opacity={visible ? 1 : 0}>
      <circle cx={x} cy="18" r="3" />
      <circle cx={x} cy="34" r="3" />
    </g>
  );
}

export function DigitalClock() {
  const { locale, t } = useI18n();
  const { preferences } = useDesktopPreferences();
  const applicationLauncher = useContext(ApplicationLauncherContext);
  const windowManager = useContext(WindowManagerContext);
  const clockRef = useRef<HTMLTimeElement | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [contextMenuState, setContextMenuState] = useState<ClockContextMenuState | null>(null);
  const nextContextMenuRequestId = useRef(1);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  const parts = getClockParts(now, locale);
  const firstColonVisible = !preferences.blinkingClockDots || now.getSeconds() % 2 === 0;
  const showDateRow = preferences.showClockDate || preferences.showDayOfWeek;
  const showSeconds = preferences.showSeconds;
  const digits = `${parts.hours}${parts.minutes}${showSeconds ? parts.seconds : ""}`.split("").map(toDigitValue);
  const dateLabel = [preferences.showDayOfWeek ? parts.weekday : null, preferences.showClockDate ? parts.date : null]
    .filter((value): value is string => value !== null)
    .join(" ");
  const launchCalendar = () => {
    const clockRect = clockRef.current?.getBoundingClientRect();

    if (!clockRect || !windowManager) {
      return;
    }

    const initialBounds = getClockAnchoredCalendarBounds(toLogicalRect(clockRect), windowManager.workArea);
    const launch = applicationLauncher?.launchUserApplication ?? applicationLauncher?.launchApplication;
    launch?.("calendar", { initialBounds });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    launchCalendar();
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    closeShellPopups();
    setContextMenuState({
      requestId: nextContextMenuRequestId.current++,
      clientX: toLogicalCoordinate(event.clientX),
      clientY: toLogicalCoordinate(event.clientY),
    });
  };

  const screenArea = windowManager?.screenArea ?? windowManager?.workArea ?? { x: 0, y: 0, width: 0, height: 0 };

  const clockAriaLabel = preferences.showClockDate
    ? t("kicker.currentTimeDate", { time: showSeconds ? parts.readableTimeWithSeconds : parts.readableTime, date: dateLabel })
    : dateLabel
      ? t("kicker.currentTimeWithLabel", { time: showSeconds ? parts.readableTimeWithSeconds : parts.readableTime, date: dateLabel })
      : t("kicker.currentTime", { time: showSeconds ? parts.readableTimeWithSeconds : parts.readableTime });

  return (
    <time
      ref={clockRef}
      className={`digital-clock${showSeconds ? " digital-clock--seconds" : ""}`}
      dateTime={now.toISOString()}
      role="button"
      tabIndex={0}
      aria-label={clockAriaLabel}
      onClick={launchCalendar}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
    >
      <span
        className={`digital-clock__time-face${showSeconds ? " digital-clock__time-face--seconds" : ""}${preferences.lcdClockLook ? "" : " digital-clock__time-face--plain"}${preferences.showClockFrame ? "" : " digital-clock__time-face--frameless"}`}
        aria-hidden="true"
        data-lcd-look={preferences.lcdClockLook ? "true" : "false"}
        data-clock-frame={preferences.showClockFrame ? "true" : "false"}
      >
        <svg className={`digital-clock__time${showSeconds ? " digital-clock__time--seconds" : ""}`} viewBox={showSeconds ? "0 0 198 52" : "0 0 128 52"} aria-hidden="true" focusable="false">
          <g data-clock-group="hours">
            <SevenSegmentDigit value={digits[0]} x={0} />
            <SevenSegmentDigit value={digits[1]} x={26} />
          </g>
          <g data-clock-group="separator"><Colon lit={true} visible={firstColonVisible} x={60} /></g>
          <g data-clock-group="minutes">
            <SevenSegmentDigit value={digits[2]} x={70} />
            <SevenSegmentDigit value={digits[3]} x={96} />
          </g>
          {showSeconds ? (
            <>
              <g data-clock-group="seconds-separator"><Colon lit={true} x={130} /></g>
              <g data-clock-group="seconds">
                <SevenSegmentDigit value={digits[4]} x={140} />
                <SevenSegmentDigit value={digits[5]} x={166} />
              </g>
            </>
          ) : null}
        </svg>
      </span>
      {showDateRow ? <span className="digital-clock__date">{dateLabel}</span> : null}
      <ClockContextMenu
        menuState={contextMenuState}
        clockRef={clockRef}
        screenArea={screenArea}
        onDismiss={() => setContextMenuState(null)}
        onLaunchApplication={(appId) => {
          const launch = applicationLauncher?.launchUserApplication ?? applicationLauncher?.launchApplication;
          launch?.(appId);
        }}
      />
    </time>
  );
}
