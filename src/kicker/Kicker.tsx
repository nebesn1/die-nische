import { DigitalClock } from "./DigitalClock/DigitalClock";
import { ClipboardApplet } from "./ClipboardApplet";
import { KMenu } from "./k-menu/KMenu";
import { QuickLaunch } from "./QuickLaunch";
import { Taskbar } from "./Taskbar";
import { VirtualDesktopPager } from "./VirtualDesktopPager";
import { useI18n } from "../i18n/useI18n";

export function Kicker() {
  const { t } = useI18n();
  return (
    <footer className="kicker" aria-label={t("kicker.panel")}>
      <KMenu />
      <QuickLaunch />
      <span className="kicker-separator" aria-hidden="true" />
      <VirtualDesktopPager />
      <Taskbar />
      <ClipboardApplet />
      <DigitalClock />
    </footer>
  );
}
