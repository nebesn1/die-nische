import { StopIcon } from "./icons";
import { formatKonquerorMediaTime } from "./mediaTime";
import { getKonquerorMediaCommandAvailability, type KonquerorMediaCommand } from "./mediaCommandModel";
import type { KonquerorMediaLoadStatus } from "./mediaViewModel";
import { useI18n } from "../../i18n/useI18n";

type KonquerorMediaControlsProps = {
  readonly status: KonquerorMediaLoadStatus;
  readonly currentTime: number;
  readonly duration: number | null;
  readonly volume: number;
  readonly muted: boolean;
  readonly disabled?: boolean;
  readonly hasPrevious?: boolean;
  readonly hasNext?: boolean;
  readonly onCommand: (command: KonquerorMediaCommand) => void;
  readonly onSeek: (value: number) => void;
  readonly onVolume: (value: number) => void;
  readonly onMute: () => void;
};

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l12 8-12 8z" fill="currentColor" /></svg>;
}

function PauseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /></svg>;
}

function PreviousIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16M19 5l-9 7 9 7z" fill="currentColor" /></svg>;
}

function NextIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 4v16M5 5l9 7-9 7z" fill="currentColor" /></svg>;
}

function SpeakerIcon({ muted }: { readonly muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 10h4l5-4v12l-5-4H4z" fill="currentColor" />
    {muted ? <path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="2" /> : <path d="M16 9c2 2 2 4 0 6M18.5 6.5c4 3 4 8 0 11" fill="none" stroke="currentColor" strokeWidth="1.5" />}
  </svg>;
}

export function KonquerorMediaControls({
  status,
  currentTime,
  duration,
  volume,
  muted,
  disabled = false,
  hasPrevious = false,
  hasNext = false,
  onCommand,
  onSeek,
  onVolume,
  onMute,
}: KonquerorMediaControlsProps) {
  const { t } = useI18n();
  const commandAvailability = getKonquerorMediaCommandAvailability(status, disabled, currentTime, hasPrevious, hasNext);
  const canSeek = !disabled && duration !== null && duration > 0;

  return (
    <section className="konqueror-media-controls" aria-label={t("konqueror.media.controls")}>
      <div className="konqueror-media-controls__transport">
        <button type="button" className="konqueror-media-control-button" aria-label={t("konqueror.menu.previous")} title={t("konqueror.menu.previous")} disabled={!commandAvailability.previous} onClick={() => onCommand("previous")}>
          <PreviousIcon />
        </button>
        <button type="button" className="konqueror-media-control-button" aria-label={t("konqueror.menu.play")} title={t("konqueror.menu.play")} disabled={!commandAvailability.play} onClick={() => onCommand("play")}>
          <PlayIcon />
        </button>
        <button type="button" className="konqueror-media-control-button" aria-label={t("konqueror.menu.pause")} title={t("konqueror.menu.pause")} disabled={!commandAvailability.pause} onClick={() => onCommand("pause")}>
          <PauseIcon />
        </button>
        <button type="button" className="konqueror-media-control-button" aria-label={t("konqueror.menu.stop")} title={t("konqueror.menu.stop")} disabled={!commandAvailability.stop} onClick={() => onCommand("stop")}>
          <StopIcon aria-hidden="true" focusable="false" />
        </button>
        <button type="button" className="konqueror-media-control-button" aria-label={t("konqueror.menu.next")} title={t("konqueror.menu.next")} disabled={!commandAvailability.next} onClick={() => onCommand("next")}>
          <NextIcon />
        </button>
        <input
          className="konqueror-media-controls__seek"
          type="range"
          min="0"
          max={duration ?? 0}
          step="any"
          value={canSeek ? Math.min(duration!, Math.max(0, currentTime)) : 0}
          disabled={!canSeek}
          aria-label={t("konqueror.media.seek")}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
        />
      </div>
      <div className="konqueror-media-controls__details">
        <span className="konqueror-media-controls__time" aria-live="off">{formatKonquerorMediaTime(currentTime)} / {formatKonquerorMediaTime(duration)}</span>
        <button type="button" className="konqueror-media-control-button konqueror-media-control-button--mute" aria-label={muted ? t("konqueror.media.unmute") : t("konqueror.media.mute")} title={muted ? t("konqueror.media.unmute") : t("konqueror.media.mute")} disabled={disabled} onClick={onMute}>
          <SpeakerIcon muted={muted} />
        </button>
        <label className="konqueror-media-controls__volume-label">
          <span className="konqueror-media-controls__sr-only">{t("konqueror.media.volume")}</span>
          <input
            className="konqueror-media-controls__volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(volume * 100)}
            disabled={disabled}
            aria-label={t("konqueror.media.volume")}
            onChange={(event) => onVolume(Number(event.currentTarget.value) / 100)}
          />
        </label>
      </div>
    </section>
  );
}
