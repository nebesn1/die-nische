import type { KonquerorResourceZoomLevel } from "../apps/konqueror/resourceZoomLevels";
import {
  DEFAULT_DESKTOP_COUNT,
  MAX_DESKTOP_COUNT,
  MIN_DESKTOP_COUNT,
} from "../window-manager/types";
import { DEFAULT_THEME_ID, isThemeId, type ThemeId } from "../theme/themeCatalog";
import { DEFAULT_DESKTOP_LOCALE, normalizeDesktopLocale, type DesktopLocale } from "../i18n/locale";

export const desktopBackgroundPresets = [
  "kde-classic",
  "deep-blue",
  "teal",
  "slate",
  "black",
] as const;

export type DesktopBackgroundPreset = (typeof desktopBackgroundPresets)[number];

export const konquerorDockOrders = ["toolbar-location", "location-toolbar"] as const;

export type KonquerorDockOrderPreference = (typeof konquerorDockOrders)[number];

export const konquerorResourceViewModes = ["tree", "icons"] as const;

export type KonquerorResourceViewModePreference = (typeof konquerorResourceViewModes)[number];

export { konquerorResourceZoomLevels } from "../apps/konqueror/resourceZoomLevels";

export type KonquerorResourceZoomPreference = KonquerorResourceZoomLevel;

export { DEFAULT_DESKTOP_COUNT, MAX_DESKTOP_COUNT, MIN_DESKTOP_COUNT } from "../window-manager/types";

export interface DesktopPreferences {
  readonly locale: DesktopLocale;
  readonly themeId: ThemeId;
  readonly backgroundPreset: DesktopBackgroundPreset;
  readonly showDesktopIcons: boolean;
  readonly showClockDate: boolean;
  readonly lcdClockLook: boolean;
  readonly showSeconds: boolean;
  readonly showDayOfWeek: boolean;
  readonly blinkingClockDots: boolean;
  readonly showClockFrame: boolean;
  readonly showTasksFromAllDesktops: boolean;
  readonly desktopCount?: number;
  readonly konquerorDockOrder: KonquerorDockOrderPreference;
  readonly konquerorResourceViewMode: KonquerorResourceViewModePreference;
  readonly konquerorResourceTreeZoom: KonquerorResourceZoomPreference;
  readonly konquerorResourceIconZoom: KonquerorResourceZoomPreference;
}

export const DEFAULT_DESKTOP_PREFERENCES: Readonly<DesktopPreferences> = Object.freeze({
  locale: DEFAULT_DESKTOP_LOCALE,
  themeId: DEFAULT_THEME_ID,
  backgroundPreset: "kde-classic",
  showDesktopIcons: true,
  showClockDate: true,
  lcdClockLook: true,
  showSeconds: false,
  showDayOfWeek: false,
  blinkingClockDots: true,
  showClockFrame: true,
  showTasksFromAllDesktops: false,
  desktopCount: DEFAULT_DESKTOP_COUNT,
  konquerorDockOrder: "toolbar-location",
  konquerorResourceViewMode: "tree",
  konquerorResourceTreeZoom: "normal",
  konquerorResourceIconZoom: "normal",
});

export function createDesktopPreferencesDraft(preferences: DesktopPreferences): DesktopPreferences {
  return {
    locale: normalizeDesktopLocale(preferences.locale),
    themeId: isThemeId(preferences.themeId) ? preferences.themeId : DEFAULT_THEME_ID,
    backgroundPreset: preferences.backgroundPreset,
    showDesktopIcons: preferences.showDesktopIcons,
    showClockDate: preferences.showClockDate,
    lcdClockLook: preferences.lcdClockLook,
    showSeconds: preferences.showSeconds ?? DEFAULT_DESKTOP_PREFERENCES.showSeconds,
    showDayOfWeek: preferences.showDayOfWeek ?? DEFAULT_DESKTOP_PREFERENCES.showDayOfWeek,
    blinkingClockDots: preferences.blinkingClockDots ?? DEFAULT_DESKTOP_PREFERENCES.blinkingClockDots,
    showClockFrame: preferences.showClockFrame ?? DEFAULT_DESKTOP_PREFERENCES.showClockFrame,
    showTasksFromAllDesktops: preferences.showTasksFromAllDesktops,
    desktopCount: getDesktopCount(preferences),
    konquerorDockOrder: preferences.konquerorDockOrder,
    konquerorResourceViewMode: preferences.konquerorResourceViewMode,
    konquerorResourceTreeZoom: preferences.konquerorResourceTreeZoom,
    konquerorResourceIconZoom: preferences.konquerorResourceIconZoom,
  };
}

export function areDesktopPreferencesEqual(
  left: DesktopPreferences,
  right: DesktopPreferences,
): boolean {
  return left.themeId === right.themeId
    && normalizeDesktopLocale(left.locale) === normalizeDesktopLocale(right.locale)
    && left.backgroundPreset === right.backgroundPreset
    && left.showDesktopIcons === right.showDesktopIcons
    && left.showClockDate === right.showClockDate
    && left.lcdClockLook === right.lcdClockLook
    && left.showSeconds === right.showSeconds
    && left.showDayOfWeek === right.showDayOfWeek
    && left.blinkingClockDots === right.blinkingClockDots
    && left.showClockFrame === right.showClockFrame
    && left.showTasksFromAllDesktops === right.showTasksFromAllDesktops
    && getDesktopCount(left) === getDesktopCount(right)
    && left.konquerorDockOrder === right.konquerorDockOrder
    && left.konquerorResourceViewMode === right.konquerorResourceViewMode
    && left.konquerorResourceTreeZoom === right.konquerorResourceTreeZoom
    && left.konquerorResourceIconZoom === right.konquerorResourceIconZoom;
}

export function getDesktopCount(preferences: Pick<DesktopPreferences, "desktopCount">): number {
  if (!Number.isInteger(preferences.desktopCount) || (preferences.desktopCount ?? 0) < MIN_DESKTOP_COUNT) {
    return DEFAULT_DESKTOP_COUNT;
  }

  return Math.min(preferences.desktopCount!, MAX_DESKTOP_COUNT);
}
