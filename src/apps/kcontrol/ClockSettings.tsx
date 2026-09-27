import {
  setKControlBlinkingClockDots,
  setKControlClockDate,
  setKControlClockDayOfWeek,
  setKControlClockFrame,
  setKControlClockSeconds,
  setKControlLcdClockLook,
  type KControlDraft,
} from "./controlCenterModel";
import { useI18n } from "../../i18n/useI18n";

type ClockSettingsProps = {
  readonly draft: KControlDraft;
  readonly onChange: (update: (draft: KControlDraft) => KControlDraft) => void;
};

export function ClockSettings({ draft, onChange }: ClockSettingsProps) {
  const { t } = useI18n();
  return (
    <div className="configure-clock-settings">
      <section className="kcontrol-page configure-clock-section" aria-labelledby="clock-display-title">
        <h2 id="clock-display-title">{t("controlCenter.display")}</h2>
        <label className="kcontrol-checkbox">
          <input
            type="checkbox"
            checked={draft.showClockDate}
            onChange={(event) => {
              const showClockDate = event.currentTarget.checked;
              onChange((current) => setKControlClockDate(current, showClockDate));
            }}
          />
          {t("controlCenter.date")}
        </label>
        <label className="kcontrol-checkbox">
          <input
            type="checkbox"
            checked={draft.showSeconds}
            onChange={(event) => {
              const showSeconds = event.currentTarget.checked;
              onChange((current) => setKControlClockSeconds(current, showSeconds));
            }}
          />
          {t("controlCenter.seconds")}
        </label>
        <label className="kcontrol-checkbox">
          <input
            type="checkbox"
            checked={draft.showDayOfWeek}
            onChange={(event) => {
              const showDayOfWeek = event.currentTarget.checked;
              onChange((current) => setKControlClockDayOfWeek(current, showDayOfWeek));
            }}
          />
          {t("controlCenter.dayOfWeek")}
        </label>
        <label className="kcontrol-checkbox">
          <input
            type="checkbox"
            checked={draft.blinkingClockDots}
            onChange={(event) => {
              const blinkingClockDots = event.currentTarget.checked;
              onChange((current) => setKControlBlinkingClockDots(current, blinkingClockDots));
            }}
          />
          {t("controlCenter.blinkingDots")}
        </label>
        <label className="kcontrol-checkbox">
          <input
            type="checkbox"
            checked={draft.showClockFrame}
            onChange={(event) => {
              const showClockFrame = event.currentTarget.checked;
              onChange((current) => setKControlClockFrame(current, showClockFrame));
            }}
          />
          {t("controlCenter.frame")}
        </label>
      </section>
      <section className="kcontrol-page configure-clock-section" aria-labelledby="clock-time-title">
        <h2 id="clock-time-title">{t("controlCenter.time")}</h2>
        <label className="kcontrol-checkbox">
          <input
            type="checkbox"
            checked={draft.lcdClockLook}
            onChange={(event) => {
              const lcdClockLook = event.currentTarget.checked;
              onChange((current) => setKControlLcdClockLook(current, lcdClockLook));
            }}
          />
          {t("controlCenter.lcdLook")}
        </label>
      </section>
    </div>
  );
}
