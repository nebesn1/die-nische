import {
  DEFAULT_DESKTOP_PREFERENCES,
  getDesktopCount,
  createDesktopPreferencesDraft,
  desktopBackgroundPresets,
  konquerorDockOrders,
  konquerorResourceZoomLevels,
  konquerorResourceViewModes,
  type DesktopBackgroundPreset,
  type DesktopPreferences,
  type KonquerorDockOrderPreference,
  type KonquerorResourceZoomPreference,
  type KonquerorResourceViewModePreference,
} from "./desktopPreferences";
import { DEFAULT_THEME_ID, isThemeId } from "../theme/themeCatalog";
import { isDesktopLocale, normalizeDesktopLocale } from "../i18n/locale";

export const DESKTOP_PREFERENCES_STORAGE_KEY = "kde3-web-desktop.preferences.desktop.v1";
export const DESKTOP_PREFERENCES_SCHEMA_VERSION = 1;

export interface PersistedDesktopPreferencesV1 {
  readonly version: typeof DESKTOP_PREFERENCES_SCHEMA_VERSION;
  readonly preferences: DesktopPreferences;
}

type PersistedDesktopPreferencesInvalidReason =
  | "malformed-json"
  | "invalid-root"
  | "invalid-version"
  | "missing-preferences"
  | "invalid-preferences";

export type ParsedDesktopPreferences =
  | { readonly type: "valid"; readonly preferences: DesktopPreferences }
  | { readonly type: "invalid"; readonly reason: PersistedDesktopPreferencesInvalidReason }
  | { readonly type: "unsupported-version"; readonly version: number };

export type DesktopPreferencesLoadResult =
  | { readonly type: "loaded"; readonly preferences: DesktopPreferences }
  | { readonly type: "loaded-without-locale"; readonly preferences: DesktopPreferences }
  | { readonly type: "missing"; readonly preferences: DesktopPreferences }
  | {
    readonly type: "invalid";
    readonly preferences: DesktopPreferences;
    readonly reason: PersistedDesktopPreferencesInvalidReason;
    readonly corruptRecordRemoved: boolean;
  }
  | { readonly type: "unsupported-version"; readonly preferences: DesktopPreferences; readonly version: number }
  | { readonly type: "storage-unavailable"; readonly preferences: DesktopPreferences }
  | { readonly type: "read-failed"; readonly preferences: DesktopPreferences };

export type DesktopPreferencesSaveResult =
  | { readonly type: "saved" }
  | { readonly type: "storage-unavailable" }
  | { readonly type: "write-failed" };

export type DesktopPreferencesPersistenceStatus =
  | DesktopPreferencesLoadResult
  | DesktopPreferencesSaveResult
  | { readonly type: "provided" };

export interface DesktopPreferencesStorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DesktopPreferencesStorage {
  load(): DesktopPreferencesLoadResult;
  save(preferences: DesktopPreferences): DesktopPreferencesSaveResult;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDesktopBackgroundPreset = (value: unknown): value is DesktopBackgroundPreset =>
  typeof value === "string" && (desktopBackgroundPresets as readonly string[]).includes(value);

const isKonquerorDockOrderPreference = (value: unknown): value is KonquerorDockOrderPreference =>
  typeof value === "string" && (konquerorDockOrders as readonly string[]).includes(value);

const isKonquerorResourceViewModePreference = (value: unknown): value is KonquerorResourceViewModePreference =>
  typeof value === "string" && (konquerorResourceViewModes as readonly string[]).includes(value);

const isKonquerorResourceZoomPreference = (value: unknown): value is KonquerorResourceZoomPreference =>
  typeof value === "string" && (konquerorResourceZoomLevels as readonly string[]).includes(value);

const parsePreferences = (value: unknown): DesktopPreferences | null => {
  const showTasksFromAllDesktops = isRecord(value) ? value.showTasksFromAllDesktops : undefined;
  const lcdClockLook = isRecord(value) ? value.lcdClockLook : undefined;
  const showSeconds = isRecord(value) ? value.showSeconds : undefined;
  const showDayOfWeek = isRecord(value) ? value.showDayOfWeek : undefined;
  const blinkingClockDots = isRecord(value) ? value.blinkingClockDots : undefined;
  const showClockFrame = isRecord(value) ? value.showClockFrame : undefined;
  const konquerorDockOrder = isRecord(value) ? value.konquerorDockOrder : undefined;
  const konquerorResourceViewMode = isRecord(value) ? value.konquerorResourceViewMode : undefined;
  const konquerorResourceTreeZoom = isRecord(value) ? value.konquerorResourceTreeZoom : undefined;
  const konquerorResourceIconZoom = isRecord(value) ? value.konquerorResourceIconZoom : undefined;
  const desktopCount = isRecord(value) ? value.desktopCount : undefined;
  const themeId = isRecord(value) ? value.themeId : undefined;
  const locale = isRecord(value) ? value.locale : undefined;

  if (!isRecord(value)
    || !isDesktopBackgroundPreset(value.backgroundPreset)
    || typeof value.showDesktopIcons !== "boolean"
    || typeof value.showClockDate !== "boolean"
    || ("locale" in value && !isDesktopLocale(locale))
    || ("lcdClockLook" in value && typeof lcdClockLook !== "boolean")
    || ("showSeconds" in value && typeof showSeconds !== "boolean")
    || ("showDayOfWeek" in value && typeof showDayOfWeek !== "boolean")
    || ("blinkingClockDots" in value && typeof blinkingClockDots !== "boolean")
    || ("showClockFrame" in value && typeof showClockFrame !== "boolean")
    || ("showTasksFromAllDesktops" in value && typeof showTasksFromAllDesktops !== "boolean")
    || ("desktopCount" in value && (!Number.isInteger(desktopCount) || (desktopCount as number) < 1))) {
    return null;
  }

  return {
    locale: normalizeDesktopLocale(locale),
    themeId: isThemeId(themeId) ? themeId : DEFAULT_THEME_ID,
    backgroundPreset: value.backgroundPreset,
    showDesktopIcons: value.showDesktopIcons,
    showClockDate: value.showClockDate,
    lcdClockLook: lcdClockLook !== false,
    showSeconds: showSeconds === true,
    showDayOfWeek: showDayOfWeek === true,
    blinkingClockDots: blinkingClockDots !== false,
    showClockFrame: showClockFrame !== false,
    showTasksFromAllDesktops: showTasksFromAllDesktops === true,
    desktopCount: typeof desktopCount === "number"
      ? getDesktopCount({ desktopCount })
      : getDesktopCount(DEFAULT_DESKTOP_PREFERENCES),
    konquerorDockOrder: isKonquerorDockOrderPreference(konquerorDockOrder)
      ? konquerorDockOrder
      : DEFAULT_DESKTOP_PREFERENCES.konquerorDockOrder,
    konquerorResourceViewMode: isKonquerorResourceViewModePreference(konquerorResourceViewMode)
      ? konquerorResourceViewMode
      : DEFAULT_DESKTOP_PREFERENCES.konquerorResourceViewMode,
    konquerorResourceTreeZoom: isKonquerorResourceZoomPreference(konquerorResourceTreeZoom)
      ? konquerorResourceTreeZoom
      : DEFAULT_DESKTOP_PREFERENCES.konquerorResourceTreeZoom,
    konquerorResourceIconZoom: isKonquerorResourceZoomPreference(konquerorResourceIconZoom)
      ? konquerorResourceIconZoom
      : DEFAULT_DESKTOP_PREFERENCES.konquerorResourceIconZoom,
  };
};

export function serializeDesktopPreferences(preferences: DesktopPreferences): string {
  const record: PersistedDesktopPreferencesV1 = {
    version: DESKTOP_PREFERENCES_SCHEMA_VERSION,
    preferences: createDesktopPreferencesDraft(preferences),
  };

  return JSON.stringify(record);
}

export function parsePersistedDesktopPreferences(raw: string): ParsedDesktopPreferences {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return { type: "invalid", reason: "malformed-json" };
  }

  if (!isRecord(value)) {
    return { type: "invalid", reason: "invalid-root" };
  }

  if (typeof value.version !== "number" || !Number.isInteger(value.version)) {
    return { type: "invalid", reason: "invalid-version" };
  }

  if (value.version !== DESKTOP_PREFERENCES_SCHEMA_VERSION) {
    return { type: "unsupported-version", version: value.version };
  }

  if (!("preferences" in value)) {
    return { type: "invalid", reason: "missing-preferences" };
  }

  const preferences = parsePreferences(value.preferences);

  if (preferences === null) {
    return { type: "invalid", reason: "invalid-preferences" };
  }

  return { type: "valid", preferences };
}

const getBrowserLocalStorage = (): DesktopPreferencesStorageBackend | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function createDesktopPreferencesStorage(
  getStorage: () => DesktopPreferencesStorageBackend | null = getBrowserLocalStorage,
): DesktopPreferencesStorage {
  const getAvailableStorage = (): DesktopPreferencesStorageBackend | null => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };

  return {
    load() {
      const storage = getAvailableStorage();

      if (storage === null) {
        return { type: "storage-unavailable", preferences: DEFAULT_DESKTOP_PREFERENCES };
      }

      let raw: string | null;

      try {
        raw = storage.getItem(DESKTOP_PREFERENCES_STORAGE_KEY);
      } catch {
        return { type: "read-failed", preferences: DEFAULT_DESKTOP_PREFERENCES };
      }

      if (raw === null) {
        return { type: "missing", preferences: DEFAULT_DESKTOP_PREFERENCES };
      }

      const parsed = parsePersistedDesktopPreferences(raw);

      if (parsed.type === "valid") {
        let hasPersistedLocale = false;

        try {
          const persistedValue: unknown = JSON.parse(raw);
          const persistedPreferences = isRecord(persistedValue) ? persistedValue.preferences : undefined;
          hasPersistedLocale = isRecord(persistedPreferences) && isDesktopLocale(persistedPreferences.locale);
        } catch {
          // parsePersistedDesktopPreferences already classified malformed JSON.
        }

        return hasPersistedLocale
          ? { type: "loaded", preferences: parsed.preferences }
          : { type: "loaded-without-locale", preferences: parsed.preferences };
      }

      if (parsed.type === "unsupported-version") {
        return {
          type: "unsupported-version",
          preferences: DEFAULT_DESKTOP_PREFERENCES,
          version: parsed.version,
        };
      }

      let corruptRecordRemoved = false;

      try {
        storage.removeItem(DESKTOP_PREFERENCES_STORAGE_KEY);
        corruptRecordRemoved = true;
      } catch {
        // A corrupt record must not prevent the current session from starting.
      }

      return {
        type: "invalid",
        preferences: DEFAULT_DESKTOP_PREFERENCES,
        reason: parsed.reason,
        corruptRecordRemoved,
      };
    },

    save(preferences) {
      const storage = getAvailableStorage();

      if (storage === null) {
        return { type: "storage-unavailable" };
      }

      try {
        storage.setItem(DESKTOP_PREFERENCES_STORAGE_KEY, serializeDesktopPreferences(preferences));
        return { type: "saved" };
      } catch {
        return { type: "write-failed" };
      }
    },
  };
}

export function getDesktopPreferencesPersistenceNotice(
  status: DesktopPreferencesPersistenceStatus,
): string | null {
  switch (status.type) {
    case "invalid":
      return "Stored settings were invalid; defaults are in use.";
    case "unsupported-version":
      return "Stored settings use a newer version; defaults are in use.";
    case "storage-unavailable":
      return "Settings are available for this session only.";
    case "read-failed":
      return "Stored settings could not be read; defaults are in use.";
    case "write-failed":
      return "Settings applied for this session, but could not be saved.";
    default:
      return null;
  }
}
