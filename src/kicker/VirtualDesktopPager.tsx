import type { CSSProperties } from "react";
import { DEFAULT_DESKTOP_COUNT, type DesktopId } from "../window-manager/types";
import { useWindowManager } from "../window-manager/useWindowManager";
import { getDesktopButtonId, getPagerKeyboardTarget } from "./pagerNavigation";
import { getDesktopPagerLayout } from "./desktopPagerLayout";
import { useI18n } from "../i18n/useI18n";

export function VirtualDesktopPager() {
  const { t } = useI18n();
  const { currentDesktopId, desktopCount = DEFAULT_DESKTOP_COUNT, switchDesktop } = useWindowManager();
  const layout = getDesktopPagerLayout(desktopCount);

  const switchAndFocusDesktop = (desktopId: DesktopId) => {
    switchDesktop(desktopId);
    window.requestAnimationFrame(() => {
      document.getElementById(getDesktopButtonId(desktopId))?.focus();
    });
  };

  return (
    <div className={`pager${layout.singleDesktop ? " pager--single" : ""}`} style={{ "--pager-columns": layout.columns } as CSSProperties} aria-label={t("kicker.virtualDesktops")}>
      {layout.desktopIds.map((desktop) => (
        <button
          key={desktop}
          id={getDesktopButtonId(desktop)}
          type="button"
          className={`pager__cell${desktop === currentDesktopId ? " is-current" : ""}`}
          aria-label={t("kicker.switchToDesktop", { number: desktop })}
          aria-pressed={desktop === currentDesktopId}
          title={t("common.desktopNumber", { number: desktop })}
          onClick={() => switchDesktop(desktop)}
          onKeyDown={(event) => {
            const targetDesktop = getPagerKeyboardTarget(desktop, event.key, desktopCount);

            if (!targetDesktop) {
              return;
            }

            event.preventDefault();
            switchAndFocusDesktop(targetDesktop);
          }}
        >
          {desktop}
        </button>
      ))}
    </div>
  );
}
