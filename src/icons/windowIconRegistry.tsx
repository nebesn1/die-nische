import type { SVGProps } from "react";
import { KonquerorNodeIcon } from "../apps/konqueror/icons";
import type { KonquerorNodeIconId } from "../apps/konqueror/nodePresentation";
import { CalendarIcon, GearIcon, KCalcIcon, KWriteIcon, KonquerorIcon, KonsoleIcon, MyComputerIcon, PanelSettingsIcon } from "./IconComponents";
import { isWindowIconId } from "./windowIconIds";

type WindowIconProps = SVGProps<SVGSVGElement> & {
  iconId: string;
};

export function WindowIcon({ iconId, ...props }: WindowIconProps) {
  if (!isWindowIconId(iconId)) {
    return <GearIcon {...props} />;
  }

  if (iconId === "about") {
    return <GearIcon {...props} />;
  }

  if (iconId === "konqueror") {
    return <KonquerorIcon {...props} />;
  }

  if (iconId === "konsole") {
    return <KonsoleIcon {...props} />;
  }

  if (iconId === "kcalc") {
    return <KCalcIcon {...props} />;
  }

  if (iconId === "calendar") {
    return <CalendarIcon {...props} />;
  }

  if (iconId === "kwrite") {
    return <KWriteIcon {...props} />;
  }

  if (iconId === "kcontrol") {
    return <GearIcon {...props} />;
  }

  if (iconId === "kfind") {
    return <KonquerorIcon {...props} />;
  }

  if (iconId === "panel-settings") {
    return <PanelSettingsIcon {...props} />;
  }

  if (iconId === "my-computer") {
    return <MyComputerIcon {...props} />;
  }

  if (
    iconId === "folder" ||
    iconId === "home" ||
    iconId === "desktop" ||
    iconId === "documents" ||
    iconId === "downloads" ||
    iconId === "music" ||
    iconId === "pictures" ||
    iconId === "videos" ||
    iconId === "trash" ||
    iconId === "cdrom" ||
    iconId === "floppy"
  ) {
    return <KonquerorNodeIcon iconId={iconId satisfies KonquerorNodeIconId} {...props} />;
  }

  return <GearIcon {...props} />;
}
