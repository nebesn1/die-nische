import type { SVGProps } from "react";
import { ProjectAboutIcon } from "../../branding/ProjectAboutIcon";
import { PROJECT_ABOUT_ICON_ID } from "../../branding/projectIdentity";
import {
  GearIcon,
  HomeIcon,
  KonquerorIcon,
  KonsoleIcon,
  MyComputerIcon,
  PanelSettingsIcon,
  ShowDesktopIcon,
  StarIcon,
  TrayLockIcon,
} from "../../icons/IconComponents";
import { WindowIcon } from "../../icons/windowIconRegistry";

type KMenuIconProps = SVGProps<SVGSVGElement> & {
  iconId: string;
};

function KMenuSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path d="M31 7a10 10 0 0 0-9 14L8 35l5 5 14-14a10 10 0 0 0 14-9l-7 7-6-6 7-7z" fill="#dce6ed" stroke="#30485b" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 36l3 3M15 31l3 3" stroke="#6c8495" strokeWidth="2" />
      <circle cx="35" cy="13" r="3" fill="#f0c341" stroke="#684d12" strokeWidth="1.5" />
    </svg>
  );
}

function KMenuUtilitiesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path d="M6 17h36v25H6z" fill="#e4a93b" stroke="#684d12" strokeWidth="2" />
      <path d="M15 17v-6h18v6" fill="#f4c95c" stroke="#684d12" strokeWidth="2" />
      <path d="M6 24h36M21 24v6h6v-6" fill="none" stroke="#fff1a8" strokeWidth="2" />
      <path d="M12 33h24" stroke="#8b641b" strokeWidth="2" />
    </svg>
  );
}

function KMenuControlCenterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect x="6" y="7" width="36" height="34" rx="2" fill="#b8d8df" stroke="#285b68" strokeWidth="2" />
      <rect x="10" y="11" width="28" height="7" fill="#397e9b" stroke="#204d5c" />
      <path d="M12 25h24M12 32h24" stroke="#356b78" strokeWidth="2" />
      <circle cx="20" cy="25" r="3" fill="#f0c341" stroke="#684d12" strokeWidth="1.5" />
      <circle cx="30" cy="32" r="3" fill="#e37b4b" stroke="#70351f" strokeWidth="1.5" />
    </svg>
  );
}

function KMenuFindFilesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path d="M5 12h15l4 5h19v24H5z" fill="#edc04a" stroke="#705517" strokeWidth="2" />
      <path d="M7 18h34v20H7z" fill="#f7d96d" stroke="#9b7420" strokeWidth="1.5" />
      <circle cx="29" cy="27" r="8" fill="#d8edf5" stroke="#285b78" strokeWidth="2" />
      <path d="M35 33l7 7" stroke="#285b78" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

function KMenuHelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <circle cx="24" cy="24" r="18" fill="#f4f4ed" stroke="#9e3030" strokeWidth="3" />
      <circle cx="24" cy="24" r="11" fill="#e06b57" stroke="#7f2727" strokeWidth="2" />
      <path d="M24 18v12M18 24h12" stroke="#fff8e4" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="3" fill="#fff8e4" />
    </svg>
  );
}

function KMenuLogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path d="M8 6h20v36H8z" fill="#d7b477" stroke="#5d4025" strokeWidth="2" />
      <path d="M13 10h10v28H13z" fill="#f1d49a" />
      <circle cx="20" cy="24" r="2" fill="#5d4025" />
      <path d="M25 24h17M35 16l8 8-8 8" fill="none" stroke="#bd3a2f" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function KMenuQuickBrowserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path d="M4 12h15l4 5h21v25H4z" fill="#e6b943" stroke="#6d5013" strokeWidth="2" />
      <path d="M7 19h34v20H7z" fill="#f6d86e" stroke="#9b7420" strokeWidth="1.5" />
      <circle cx="30" cy="28" r="8" fill="#75b8de" stroke="#245579" strokeWidth="2" />
      <path d="M22 28h16M30 20c-3 4-3 12 0 16M30 20c3 4 3 12 0 16" stroke="#e8fbff" strokeWidth="1.2" />
    </svg>
  );
}

export function KMenuEntryIcon({ iconId, ...props }: KMenuIconProps) {
  if (iconId === PROJECT_ABOUT_ICON_ID) {
    return <ProjectAboutIcon {...props} />;
  }

  if (iconId === "konqueror" || iconId === "konsole" || iconId === "kcalc" || iconId === "kwrite" || iconId === "about" || iconId === "kcontrol" || iconId === "kfind") {
    return <WindowIcon iconId={iconId} {...props} />;
  }

  if (iconId === "home") {
    return <HomeIcon {...props} />;
  }

  if (iconId === "kmenu-settings") {
    return <KMenuSettingsIcon {...props} />;
  }

  if (iconId === "kmenu-system") {
    return <MyComputerIcon {...props} />;
  }

  if (iconId === "kmenu-utilities") {
    return <KMenuUtilitiesIcon {...props} />;
  }

  if (iconId === "kmenu-control-center") {
    return <KMenuControlCenterIcon {...props} />;
  }

  if (iconId === "kmenu-find-files") {
    return <KMenuFindFilesIcon {...props} />;
  }

  if (iconId === "kmenu-help") {
    return <KMenuHelpIcon {...props} />;
  }

  if (iconId === "kmenu-logout") {
    return <KMenuLogoutIcon {...props} />;
  }

  if (iconId === "kmenu-quick-browser") {
    return <KMenuQuickBrowserIcon {...props} />;
  }

  if (iconId === "panel-settings") {
    return <PanelSettingsIcon {...props} />;
  }

  if (iconId === "internet") {
    return <KonquerorIcon {...props} />;
  }

  if (iconId === "bookmark") {
    return <StarIcon {...props} />;
  }

  if (iconId === "lock-screen") {
    return <TrayLockIcon {...props} />;
  }

  if (iconId === "run-command") {
    return <KonsoleIcon {...props} />;
  }

  if (iconId === "games" || iconId === "edutainment" || iconId === "multimedia") {
    return <StarIcon {...props} />;
  }

  if (iconId === "graphics" || iconId === "office" || iconId === "editors") {
    return <ShowDesktopIcon {...props} />;
  }

  return <GearIcon {...props} />;
}
