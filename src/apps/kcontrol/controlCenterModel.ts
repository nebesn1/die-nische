import {
  areDesktopPreferencesEqual,
  createDesktopPreferencesDraft,
  MAX_DESKTOP_COUNT,
  type DesktopBackgroundPreset,
  type DesktopPreferences,
} from "../../preferences/desktopPreferences";
import type { ThemeId } from "../../theme/themeCatalog";
import type { DesktopLocale } from "../../i18n/locale";
import type { TranslationKey } from "../../i18n/messages/en";

export type KControlDraft = DesktopPreferences;
export type KControlPage = "background" | "theme-manager" | "icons" | "multiple-desktops" | "language";

export type KControlTreeCategoryId = "appearance-themes" | "desktop" | "regional-accessibility";
export type KControlTreeLeafId = "background" | "theme-manager" | "behavior" | "multiple-desktops" | "country-region-language";

export type KControlTreeNode =
  | {
    readonly type: "category";
    readonly id: KControlTreeCategoryId;
    readonly label: string;
    readonly children: readonly KControlTreeLeaf[];
  }
  | KControlTreeLeaf;

export type KControlTreeLeaf = {
  readonly type: "leaf";
  readonly id: KControlTreeLeafId;
  readonly label: string;
  readonly page: KControlPage;
};

export type KControlTreeRow =
  | (Extract<KControlTreeNode, { type: "category" }> & { readonly depth: 0 })
  | (KControlTreeLeaf & { readonly depth: 1; readonly isLastChild: boolean });

export const controlCenterTree: readonly Extract<KControlTreeNode, { type: "category" }>[] = [
  {
    type: "category",
    id: "appearance-themes",
    label: "Appearance & Themes",
    children: [
      { type: "leaf", id: "background", label: "Background", page: "background" },
      { type: "leaf", id: "theme-manager", label: "Theme Manager", page: "theme-manager" },
    ],
  },
  {
    type: "category",
    id: "desktop",
    label: "Desktop",
    children: [
      { type: "leaf", id: "behavior", label: "Behavior", page: "icons" },
      { type: "leaf", id: "multiple-desktops", label: "Multiple Desktops", page: "multiple-desktops" },
    ],
  },
  {
    type: "category",
    id: "regional-accessibility",
    label: "Regional & Accessibility",
    children: [
      { type: "leaf", id: "country-region-language", label: "Country/Region & Language", page: "language" },
    ],
  },
];

export const initialControlCenterExpandedCategories: readonly KControlTreeCategoryId[] = [];

export type KControlTreeExpansionRequest = {
  readonly requestId: number;
  readonly expandedCategories: readonly KControlTreeCategoryId[];
};

export function getVisibleControlCenterTreeRows(
  expandedCategories: readonly KControlTreeCategoryId[],
): readonly KControlTreeRow[] {
  return controlCenterTree.flatMap((category): readonly KControlTreeRow[] => [
    { ...category, depth: 0 },
    ...(expandedCategories.includes(category.id)
      ? category.children.map((leaf, index): KControlTreeRow => ({
        ...leaf,
        depth: 1 as const,
        isLastChild: index === category.children.length - 1,
      }))
      : []),
  ]);
}

export function getKControlWindowTitle(page: KControlPage | null): string {
  if (page === "background") {
    return "Background - Control Center";
  }

  if (page === "theme-manager") {
    return "Theme Manager - Control Center";
  }

  if (page === "icons") {
    return "Behavior - Control Center";
  }

  if (page === "multiple-desktops") {
    return "Multiple Desktops - Control Center";
  }

  if (page === "language") {
    return "Country/Region & Language - Control Center";
  }

  return "Control Center";
}

export function getKControlWindowTitleKey(page: KControlPage | null): TranslationKey {
  if (page === "background") return "controlCenter.background";
  if (page === "theme-manager") return "controlCenter.themeManager";
  if (page === "icons") return "controlCenter.behavior";
  if (page === "multiple-desktops") return "controlCenter.multipleDesktops";
  if (page === "language") return "controlCenter.countryRegionLanguage";
  return "controlCenter.title";
}

export function getKControlTreeLabelKey(id: KControlTreeCategoryId | KControlTreeLeafId): TranslationKey {
  if (id === "appearance-themes") return "controlCenter.appearanceThemes";
  if (id === "desktop") return "controlCenter.desktop";
  if (id === "regional-accessibility") return "controlCenter.regionalAccessibility";
  if (id === "background") return "controlCenter.background";
  if (id === "theme-manager") return "controlCenter.themeManager";
  if (id === "behavior") return "controlCenter.behavior";
  if (id === "multiple-desktops") return "controlCenter.multipleDesktops";
  return "controlCenter.countryRegionLanguage";
}

export function getKControlPageForTreeLeaf(id: KControlTreeLeafId): KControlPage {
  if (id === "background" || id === "theme-manager") {
    return id;
  }

  if (id === "country-region-language") {
    return "language";
  }

  return id === "behavior" ? "icons" : "multiple-desktops";
}

export function createKControlDraft(applied: DesktopPreferences): DesktopPreferences {
  return createDesktopPreferencesDraft(applied);
}

export function parseKControlDesktopCountDraft(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const desktopCount = Number(value);

  return Number.isInteger(desktopCount) && desktopCount >= 1 && desktopCount <= MAX_DESKTOP_COUNT
    ? desktopCount
    : null;
}

export function isKControlDraftDirty(draft: DesktopPreferences, applied: DesktopPreferences): boolean {
  return !areDesktopPreferencesEqual(draft, applied);
}

export function shouldConfirmKControlClose(draft: DesktopPreferences, applied: DesktopPreferences): boolean {
  return isKControlDraftDirty(draft, applied);
}

export function setKControlBackground(
  draft: DesktopPreferences,
  backgroundPreset: DesktopBackgroundPreset,
): DesktopPreferences {
  return draft.backgroundPreset === backgroundPreset ? draft : { ...draft, backgroundPreset };
}

export function setKControlTheme(draft: DesktopPreferences, themeId: ThemeId): DesktopPreferences {
  return draft.themeId === themeId ? draft : { ...draft, themeId };
}

export function setKControlLocale(draft: DesktopPreferences, locale: DesktopLocale): DesktopPreferences {
  return draft.locale === locale ? draft : { ...draft, locale };
}

export function setKControlDesktopIcons(draft: DesktopPreferences, showDesktopIcons: boolean): DesktopPreferences {
  return draft.showDesktopIcons === showDesktopIcons ? draft : { ...draft, showDesktopIcons };
}

export function setKControlClockDate(draft: DesktopPreferences, showClockDate: boolean): DesktopPreferences {
  return draft.showClockDate === showClockDate ? draft : { ...draft, showClockDate };
}

export function setKControlLcdClockLook(draft: DesktopPreferences, lcdClockLook: boolean): DesktopPreferences {
  return draft.lcdClockLook === lcdClockLook ? draft : { ...draft, lcdClockLook };
}

export function setKControlClockSeconds(draft: DesktopPreferences, showSeconds: boolean): DesktopPreferences {
  return draft.showSeconds === showSeconds ? draft : { ...draft, showSeconds };
}

export function setKControlClockDayOfWeek(draft: DesktopPreferences, showDayOfWeek: boolean): DesktopPreferences {
  return draft.showDayOfWeek === showDayOfWeek ? draft : { ...draft, showDayOfWeek };
}

export function setKControlBlinkingClockDots(draft: DesktopPreferences, blinkingClockDots: boolean): DesktopPreferences {
  return draft.blinkingClockDots === blinkingClockDots ? draft : { ...draft, blinkingClockDots };
}

export function setKControlClockFrame(draft: DesktopPreferences, showClockFrame: boolean): DesktopPreferences {
  return draft.showClockFrame === showClockFrame ? draft : { ...draft, showClockFrame };
}

export function setKControlShowTasksFromAllDesktops(
  draft: DesktopPreferences,
  showTasksFromAllDesktops: boolean,
): DesktopPreferences {
  return draft.showTasksFromAllDesktops === showTasksFromAllDesktops
    ? draft
    : { ...draft, showTasksFromAllDesktops };
}

export function setKControlDesktopCount(draft: DesktopPreferences, desktopCount: number): DesktopPreferences {
  const nextCount = Number.isInteger(desktopCount) && desktopCount >= 1 && desktopCount <= MAX_DESKTOP_COUNT
    ? desktopCount
    : draft.desktopCount;
  return nextCount === draft.desktopCount ? draft : { ...draft, desktopCount: nextCount };
}
