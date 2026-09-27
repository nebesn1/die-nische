import type { ComponentType, SVGProps } from "react";
import { useApplicationLauncher } from "../application-runtime/useApplicationLauncher";
import { createKonquerorOpenLocationIntent, createKonquerorOpenStartIntent } from "../apps/konqueror/launchIntent";
import {
  HomeIcon,
  HomeOpenIcon,
  KonquerorIcon,
  KonquerorOpenIcon,
  KonsoleIcon,
  ShowDesktopIcon,
} from "../icons/IconComponents";
import { useWindowManager } from "../window-manager/useWindowManager";
import { getQuickLaunchOpenState } from "./quickLaunchOpenState";
import { useI18n } from "../i18n/useI18n";
import type { TranslationKey } from "../i18n/messages/en";

type QuickLaunchAction =
  | { type: "launch-application"; appId: string; intent?: unknown; newInstance?: boolean }
  | { type: "toggle-show-desktop" };

type LauncherItem = {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  OpenIcon?: ComponentType<SVGProps<SVGSVGElement>>;
  action: QuickLaunchAction;
  disabled?: boolean;
  title?: string;
  labelKey: TranslationKey;
};

const launchers: readonly LauncherItem[] = [
  { id: "show-desktop", label: "Show Desktop", labelKey: "kicker.showDesktop", Icon: ShowDesktopIcon, action: { type: "toggle-show-desktop" } },
  {
    id: "home",
    label: "Home",
    labelKey: "kicker.home",
    Icon: HomeIcon,
    OpenIcon: HomeOpenIcon,
    action: { type: "launch-application", appId: "konqueror", intent: createKonquerorOpenLocationIntent("home"), newInstance: true },
  },
  {
    id: "konqueror",
    label: "Konqueror",
    labelKey: "kicker.konqueror",
    Icon: KonquerorIcon,
    OpenIcon: KonquerorOpenIcon,
    action: { type: "launch-application", appId: "konqueror", intent: createKonquerorOpenStartIntent(), newInstance: true },
  },
  {
    id: "konsole",
    label: "Konsole",
    labelKey: "kicker.konsole",
    Icon: KonsoleIcon,
    action: { type: "launch-application", appId: "konsole", newInstance: true },
  },
];

export function QuickLaunch() {
  const { t } = useI18n();
  const {
    launchApplication,
    launchNewApplicationInstance,
    launchNewUserApplicationInstance,
    launchUserApplication,
  } = useApplicationLauncher();
  const userLaunchApplication = launchUserApplication ?? launchApplication;
  const userLaunchNewApplicationInstance = launchNewUserApplicationInstance ?? launchNewApplicationInstance;
  const { currentDesktopId, launcherMetadataByWindowId, showDesktopSessionByDesktop, toggleShowDesktop, windows } = useWindowManager();
  const isShowingDesktop = showDesktopSessionByDesktop[currentDesktopId] !== null;
  const openState = getQuickLaunchOpenState(windows, currentDesktopId, launcherMetadataByWindowId);

  const handleLaunch = (item: LauncherItem) => {
    if (item.action.type === "launch-application") {
      const launch = item.action.newInstance ? userLaunchNewApplicationInstance : userLaunchApplication;
      launch(item.action.appId, item.action.intent === undefined ? undefined : { intent: item.action.intent });
      return;
    }

    if (item.action.type === "toggle-show-desktop") {
      toggleShowDesktop();
    }
  };

  return (
    <div className="quick-launch" aria-label={t("kicker.quickLaunch")}>
      {launchers.map((item) => (
        (() => {
          const isShowDesktopButton = item.action.type === "toggle-show-desktop";
          const isPressed = isShowDesktopButton && isShowingDesktop;
          const isApplicationOpen = item.id === "konqueror"
            ? openState.konqueror
            : item.id === "home" && openState.home;
          const Icon = isApplicationOpen && item.OpenIcon ? item.OpenIcon : item.Icon;
          const label = isShowDesktopButton && isShowingDesktop ? t("common.restoreWindows") : t(item.labelKey);
          const title = isShowDesktopButton && isShowingDesktop ? t("common.restoreWindows") : item.title;

          return (
            <button
              key={item.id}
              type="button"
              className={`kicker-launcher kicker-button${isPressed ? " is-active" : ""}`}
              aria-label={label}
              aria-pressed={isShowDesktopButton ? isPressed : undefined}
              disabled={item.disabled}
              title={title}
              onClick={() => handleLaunch(item)}
            >
              <span className="quick-launch__icon" data-icon-variant={isApplicationOpen ? "open" : "closed"}>
                <Icon aria-hidden="true" focusable="false" />
              </span>
            </button>
          );
        })()
      ))}
    </div>
  );
}
