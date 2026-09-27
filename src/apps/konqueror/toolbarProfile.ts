import type { KonquerorPreviewerId } from "./previewModel";
import type { KonquerorView } from "./navigationTypes";
import type { WindowLayoutMode } from "../../window-manager/types";

export type KonquerorToolbarProfile = "resource-manager" | "web" | "document" | "image" | "media";

export type KonquerorToolbarAction =
  | "up"
  | "back"
  | "forward"
  | "home"
  | "reload"
  | "stop"
  | "cut"
  | "copy"
  | "paste"
  | "print"
  | "zoom-in"
  | "zoom-menu"
  | "zoom-out"
  | "previous-image"
  | "next-image"
  | "rotate-right"
  | "icon-view"
  | "tree-view"
  | "security";

export type KonquerorToolbarActionGroup = readonly KonquerorToolbarAction[];

const MOBILE_NAVIGATION_ACTION_GROUP = ["up", "back", "forward", "home", "reload", "stop"] as const;

const NAVIGATION_ACTION_GROUPS = [
  ["up", "back", "forward", "home"],
  ["reload", "stop"],
] as const;
const CLIPBOARD_ACTIONS = ["cut", "copy", "paste"] as const;
const OUTPUT_ACTIONS = ["print"] as const;
const ZOOM_ACTIONS = ["zoom-in", "zoom-out"] as const;

const ACTION_GROUPS_BY_PROFILE: Readonly<Record<KonquerorToolbarProfile, readonly KonquerorToolbarActionGroup[]>> = {
  "resource-manager": [
    ...NAVIGATION_ACTION_GROUPS,
    CLIPBOARD_ACTIONS,
    OUTPUT_ACTIONS,
    ZOOM_ACTIONS,
    ["icon-view", "tree-view"],
  ],
  web: [
    ...NAVIGATION_ACTION_GROUPS,
    CLIPBOARD_ACTIONS,
    OUTPUT_ACTIONS,
    ZOOM_ACTIONS,
    ["security"],
  ],
  document: [
    ...NAVIGATION_ACTION_GROUPS,
    CLIPBOARD_ACTIONS,
    OUTPUT_ACTIONS,
    ZOOM_ACTIONS,
  ],
  image: [
    ...NAVIGATION_ACTION_GROUPS,
    CLIPBOARD_ACTIONS,
    ["print", "previous-image", "next-image", "zoom-in", "zoom-menu", "zoom-out", "rotate-right"],
  ],
  media: [
    ...NAVIGATION_ACTION_GROUPS,
    CLIPBOARD_ACTIONS,
    OUTPUT_ACTIONS,
  ],
};

export function getKonquerorToolbarProfile(
  view: KonquerorView,
  previewerId: KonquerorPreviewerId | null,
): KonquerorToolbarProfile {
  switch (view.type) {
    case "directory":
    case "sysinfo":
      return "resource-manager";
    case "about-konqueror":
    case "about-blank":
    case "external-web":
      return "web";
    case "file":
      return previewerId === "image"
        ? "image"
        : previewerId === "media-audio" || previewerId === "media-video"
        ? "media"
        : previewerId === "khtml"
        ? "web"
        : "document";
    case "file-unavailable":
    case "error":
      return "document";
  }
}

export function getKonquerorToolbarActionGroups(
  profile: KonquerorToolbarProfile,
  layoutMode: WindowLayoutMode = "desktop",
): readonly KonquerorToolbarActionGroup[] {
  return layoutMode === "mobile"
    ? [MOBILE_NAVIGATION_ACTION_GROUP]
    : ACTION_GROUPS_BY_PROFILE[profile];
}
