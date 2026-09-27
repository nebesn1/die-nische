import {
  setKControlShowTasksFromAllDesktops,
  type KControlDraft,
} from "./controlCenterModel";
import { useI18n } from "../../i18n/useI18n";

type PanelSettingsProps = {
  readonly draft: KControlDraft;
  readonly onChange: (update: (draft: KControlDraft) => KControlDraft) => void;
};

export function PanelSettings({ draft, onChange }: PanelSettingsProps) {
  const { t } = useI18n();
  return (
    <section className="kcontrol-page" aria-labelledby="panel-settings-title">
      <h2 id="panel-settings-title">{t("controlCenter.panel")}</h2>
      <label className="kcontrol-checkbox">
        <input
          type="checkbox"
          checked={draft.showTasksFromAllDesktops}
          onChange={(event) => {
            const showTasksFromAllDesktops = event.currentTarget.checked;
            onChange((current) => setKControlShowTasksFromAllDesktops(current, showTasksFromAllDesktops));
          }}
        />
        {t("controlCenter.showTasksFromAllDesktops")}
      </label>
    </section>
  );
}
