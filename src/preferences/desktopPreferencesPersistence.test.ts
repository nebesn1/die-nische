import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_PREFERENCES_SCHEMA_VERSION,
  DESKTOP_PREFERENCES_STORAGE_KEY,
  createDesktopPreferencesStorage,
  getDesktopPreferencesPersistenceNotice,
  parsePersistedDesktopPreferences,
  serializeDesktopPreferences,
  type DesktopPreferencesStorageBackend,
} from "./desktopPreferencesPersistence";
import { DEFAULT_DESKTOP_PREFERENCES } from "./desktopPreferences";

function createMemoryStorage(initial: Readonly<Record<string, string>> = {}): DesktopPreferencesStorageBackend & { readonly values: Map<string, string> } {
  const values = new Map(Object.entries(initial));

  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const tealWithoutIconsOrDate = {
  locale: "en" as const,
  themeId: "kde-classic" as const,
  backgroundPreset: "teal" as const,
  showDesktopIcons: false,
  showClockDate: false,
  lcdClockLook: true,
  showSeconds: false,
  showDayOfWeek: false,
  blinkingClockDots: true,
  showClockFrame: true,
  showTasksFromAllDesktops: false,
  desktopCount: 4,
  konquerorDockOrder: "toolbar-location" as const,
  konquerorResourceViewMode: "tree" as const,
  konquerorResourceTreeZoom: "normal" as const,
  konquerorResourceIconZoom: "normal" as const,
};

describe("desktop preferences persistence schema", () => {
  it("serializes one versioned record and preserves false booleans", () => {
    const serialized = serializeDesktopPreferences(tealWithoutIconsOrDate);

    expect(DESKTOP_PREFERENCES_SCHEMA_VERSION).toBe(1);
    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      preferences: tealWithoutIconsOrDate,
    });
    expect(parsePersistedDesktopPreferences(serialized)).toEqual({ type: "valid", preferences: tealWithoutIconsOrDate });
  });

  it("round-trips the all-desktops task and Konqueror view settings without a second storage key or version", () => {
    const enabled = { ...tealWithoutIconsOrDate, showTasksFromAllDesktops: true };

    expect(parsePersistedDesktopPreferences(serializeDesktopPreferences(enabled)))
      .toEqual({ type: "valid", preferences: enabled });
  });

  it.each(["toolbar-location", "location-toolbar"] as const)("round-trips the %s Konqueror dock order", (konquerorDockOrder) => {
    const preferences = { ...tealWithoutIconsOrDate, konquerorDockOrder };

    expect(parsePersistedDesktopPreferences(serializeDesktopPreferences(preferences)))
      .toEqual({ type: "valid", preferences });
  });

  it.each(["tree", "icons"] as const)("round-trips the %s Konqueror Resource view mode", (konquerorResourceViewMode) => {
    const preferences = { ...tealWithoutIconsOrDate, konquerorResourceViewMode };

    expect(parsePersistedDesktopPreferences(serializeDesktopPreferences(preferences)))
      .toEqual({ type: "valid", preferences });
  });

  it.each(["small", "normal", "large", "extra-large"] as const)("round-trips the %s Tree zoom", (konquerorResourceTreeZoom) => {
    const preferences = { ...tealWithoutIconsOrDate, konquerorResourceTreeZoom };

    expect(parsePersistedDesktopPreferences(serializeDesktopPreferences(preferences)))
      .toEqual({ type: "valid", preferences });
  });

  it.each(["small", "normal", "large", "extra-large"] as const)("round-trips the %s Icon zoom", (konquerorResourceIconZoom) => {
    const preferences = { ...tealWithoutIconsOrDate, konquerorResourceIconZoom };

    expect(parsePersistedDesktopPreferences(serializeDesktopPreferences(preferences)))
      .toEqual({ type: "valid", preferences });
  });

  it.each(["kde-classic", "deep-blue", "teal", "slate", "black"])("accepts the %s background preset", (backgroundPreset) => {
    const parsed = parsePersistedDesktopPreferences(JSON.stringify({
      version: 1,
      preferences: { backgroundPreset, showDesktopIcons: true, showClockDate: true },
    }));

    expect(parsed).toEqual({
      type: "valid",
      preferences: {
        locale: "en",
        themeId: "kde-classic",
        backgroundPreset,
        showDesktopIcons: true,
        showClockDate: true,
        lcdClockLook: true,
        showSeconds: false,
        showDayOfWeek: false,
        blinkingClockDots: true,
        showClockFrame: true,
        showTasksFromAllDesktops: false,
        desktopCount: 4,
        konquerorDockOrder: "toolbar-location",
        konquerorResourceViewMode: "tree",
        konquerorResourceTreeZoom: "normal",
        konquerorResourceIconZoom: "normal",
      },
    });
  });

  it.each(["zh-CN", "de"] as const)("round-trips the %s desktop locale without a second preference record", (locale) => {
    const parsed = parsePersistedDesktopPreferences(JSON.stringify({
      version: 1,
      preferences: { ...tealWithoutIconsOrDate, locale },
    }));

    expect(parsed).toEqual({ type: "valid", preferences: { ...tealWithoutIconsOrDate, locale } });
  });

  it("rejects an explicitly invalid locale so first-visit detection can run", () => {
    const parsed = parsePersistedDesktopPreferences(JSON.stringify({
      version: 1,
      preferences: { ...tealWithoutIconsOrDate, locale: "fr" },
    }));

    expect(parsed).toEqual({ type: "invalid", reason: "invalid-preferences" });
  });

  it("round-trips Redmond as the single persisted theme preference", () => {
    const parsed = parsePersistedDesktopPreferences(serializeDesktopPreferences({
      ...tealWithoutIconsOrDate,
      themeId: "redmond",
    }));

    expect(parsed).toEqual({
      type: "valid",
      preferences: { ...tealWithoutIconsOrDate, themeId: "redmond" },
    });
  });

  it.each([undefined, null, "future-theme", 42])("falls back to KDE_Classic for an unsupported theme: %j", (themeId) => {
    const parsed = parsePersistedDesktopPreferences(JSON.stringify({
      version: 1,
      preferences: { ...tealWithoutIconsOrDate, themeId },
    }));

    expect(parsed).toEqual({
      type: "valid",
      preferences: { ...tealWithoutIconsOrDate, themeId: "kde-classic" },
    });
  });

  it("accepts harmless unknown fields without returning them to runtime preferences", () => {
    const parsed = parsePersistedDesktopPreferences(JSON.stringify({
      version: 1,
      ignored: "future metadata",
      preferences: { ...tealWithoutIconsOrDate, futureThing: 123 },
    }));

    expect(parsed).toEqual({ type: "valid", preferences: tealWithoutIconsOrDate });
  });

  it.each([undefined, null, "", "toolbar", "location", "foobar", 42])(
    "falls back to the default dock order for an unsupported stored value: %j",
    (konquerorDockOrder) => {
      const parsed = parsePersistedDesktopPreferences(JSON.stringify({
        version: 1,
        preferences: { ...tealWithoutIconsOrDate, konquerorDockOrder },
      }));

      expect(parsed).toEqual({
        type: "valid",
        preferences: { ...tealWithoutIconsOrDate, konquerorDockOrder: "toolbar-location" },
      });
    },
  );

  it.each([undefined, null, "", "icon", "list", "foobar", 42])(
    "falls back to the default Resource view mode for an unsupported stored value: %j",
    (konquerorResourceViewMode) => {
      const parsed = parsePersistedDesktopPreferences(JSON.stringify({
        version: 1,
        preferences: { ...tealWithoutIconsOrDate, konquerorResourceViewMode },
      }));

      expect(parsed).toEqual({
        type: "valid",
        preferences: { ...tealWithoutIconsOrDate, konquerorResourceViewMode: "tree" },
      });
    },
  );

  it("loads an older record without a Resource view mode while preserving its dock order", () => {
    const olderPreferences = {
      backgroundPreset: tealWithoutIconsOrDate.backgroundPreset,
      showDesktopIcons: tealWithoutIconsOrDate.showDesktopIcons,
      showClockDate: tealWithoutIconsOrDate.showClockDate,
      showTasksFromAllDesktops: tealWithoutIconsOrDate.showTasksFromAllDesktops,
      konquerorDockOrder: tealWithoutIconsOrDate.konquerorDockOrder,
    };
    const parsed = parsePersistedDesktopPreferences(JSON.stringify({ version: 1, preferences: olderPreferences }));

    expect(parsed).toEqual({
      type: "valid",
      preferences: {
        ...tealWithoutIconsOrDate,
        konquerorResourceViewMode: "tree",
        konquerorResourceTreeZoom: "normal",
        konquerorResourceIconZoom: "normal",
      },
    });
  });

  it("loads legacy preferences without desktopCount as the four-desktop default", () => {
    const legacyPreferences = Object.fromEntries(
      Object.entries(tealWithoutIconsOrDate).filter(([key]) => key !== "desktopCount"),
    );

    expect(parsePersistedDesktopPreferences(JSON.stringify({ version: 1, preferences: legacyPreferences }))).toEqual({
      type: "valid",
      preferences: tealWithoutIconsOrDate,
    });
  });

  it("defaults LCD look on when loading a legacy record without the field", () => {
    const legacyPreferences = { ...tealWithoutIconsOrDate };
    delete (legacyPreferences as { lcdClockLook?: boolean }).lcdClockLook;

    expect(parsePersistedDesktopPreferences(JSON.stringify({ version: 1, preferences: legacyPreferences }))).toEqual({
      type: "valid",
      preferences: tealWithoutIconsOrDate,
    });
  });

  it("defaults the new clock display fields when loading a legacy record without them", () => {
    const legacyPreferences = {
      backgroundPreset: "teal",
      showDesktopIcons: true,
      showClockDate: true,
      lcdClockLook: false,
    };

    expect(parsePersistedDesktopPreferences(JSON.stringify({ version: 1, preferences: legacyPreferences }))).toEqual({
      type: "valid",
      preferences: {
        ...DEFAULT_DESKTOP_PREFERENCES,
        backgroundPreset: "teal",
        showDesktopIcons: true,
        showClockDate: true,
        lcdClockLook: false,
      },
    });
  });

  it("round-trips a disabled LCD look preference", () => {
    const preferences = { ...tealWithoutIconsOrDate, lcdClockLook: false };

    expect(parsePersistedDesktopPreferences(serializeDesktopPreferences(preferences)))
      .toEqual({ type: "valid", preferences });
  });

  it.each([0, -1, 1.5, "4", null])("rejects an invalid persisted desktop count: %j", (desktopCount) => {
    expect(parsePersistedDesktopPreferences(JSON.stringify({
      version: 1,
      preferences: { ...tealWithoutIconsOrDate, desktopCount },
    }))).toEqual({ type: "invalid", reason: "invalid-preferences" });
  });

  it("clamps a legacy persisted desktop count above the supported maximum", () => {
    const parsed = parsePersistedDesktopPreferences(JSON.stringify({
      version: 1,
      preferences: { ...tealWithoutIconsOrDate, desktopCount: 25 },
    }));

    expect(parsed).toEqual({
      type: "valid",
      preferences: { ...tealWithoutIconsOrDate, desktopCount: 20 },
    });
  });

  it.each([undefined, null, "", "12px", "999", "tree", 42])(
    "falls back only the Tree zoom for an unsupported stored value: %j",
    (konquerorResourceTreeZoom) => {
      const parsed = parsePersistedDesktopPreferences(JSON.stringify({
        version: 1,
        preferences: { ...tealWithoutIconsOrDate, konquerorResourceTreeZoom, konquerorResourceIconZoom: "large" },
      }));

      expect(parsed).toEqual({
        type: "valid",
        preferences: { ...tealWithoutIconsOrDate, konquerorResourceTreeZoom: "normal", konquerorResourceIconZoom: "large" },
      });
    },
  );

  it.each([undefined, null, "", "16px", "999", "icons", 42])(
    "falls back only the Icon zoom for an unsupported stored value: %j",
    (konquerorResourceIconZoom) => {
      const parsed = parsePersistedDesktopPreferences(JSON.stringify({
        version: 1,
        preferences: { ...tealWithoutIconsOrDate, konquerorResourceTreeZoom: "small", konquerorResourceIconZoom },
      }));

      expect(parsed).toEqual({
        type: "valid",
        preferences: { ...tealWithoutIconsOrDate, konquerorResourceTreeZoom: "small", konquerorResourceIconZoom: "normal" },
      });
    },
  );

  it.each([
    "{broken",
    "",
    "null",
    "[]",
    '"hello"',
    "42",
    "true",
    JSON.stringify({ preferences: tealWithoutIconsOrDate }),
    JSON.stringify({ version: "1", preferences: tealWithoutIconsOrDate }),
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, preferences: null }),
    JSON.stringify({ version: 1, preferences: { ...tealWithoutIconsOrDate, backgroundPreset: "pink-hacker-theme" } }),
    JSON.stringify({ version: 1, preferences: { backgroundPreset: "teal", showDesktopIcons: "false", showClockDate: false } }),
    JSON.stringify({ version: 1, preferences: { backgroundPreset: "teal", showDesktopIcons: false } }),
    JSON.stringify({ version: 1, preferences: { ...tealWithoutIconsOrDate, showTasksFromAllDesktops: "true" } }),
  ])("rejects invalid current-version data: %s", (raw) => {
    expect(parsePersistedDesktopPreferences(raw).type).toBe("invalid");
  });

  it("recognizes unsupported numeric versions without treating them as malformed current data", () => {
    expect(parsePersistedDesktopPreferences(JSON.stringify({ version: 99, preferences: tealWithoutIconsOrDate })))
      .toEqual({ type: "unsupported-version", version: 99 });
  });
});

describe("desktop preferences browser storage adapter", () => {
  it("loads a valid persisted record and falls back to defaults for a missing record", () => {
    const storage = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: serializeDesktopPreferences(tealWithoutIconsOrDate),
    });
    const adapter = createDesktopPreferencesStorage(() => storage);

    expect(adapter.load()).toEqual({ type: "loaded", preferences: tealWithoutIconsOrDate });
    storage.removeItem(DESKTOP_PREFERENCES_STORAGE_KEY);
    expect(adapter.load()).toEqual({
      type: "missing",
      preferences: {
        locale: "en",
        themeId: "kde-classic",
        backgroundPreset: "kde-classic",
        showDesktopIcons: true,
        showClockDate: true,
        lcdClockLook: true,
        showSeconds: false,
        showDayOfWeek: false,
        blinkingClockDots: true,
        showClockFrame: true,
        showTasksFromAllDesktops: false,
        desktopCount: 4,
        konquerorDockOrder: "toolbar-location",
        konquerorResourceViewMode: "tree",
        konquerorResourceTreeZoom: "normal",
        konquerorResourceIconZoom: "normal",
      },
    });
  });

  it("distinguishes a valid legacy record without a persisted locale", () => {
    const legacyPreferences = { ...tealWithoutIconsOrDate };
    delete (legacyPreferences as { locale?: "en" }).locale;
    const storage = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: JSON.stringify({ version: 1, preferences: legacyPreferences }),
    });

    expect(createDesktopPreferencesStorage(() => storage).load()).toEqual({
      type: "loaded-without-locale",
      preferences: tealWithoutIconsOrDate,
    });
  });

  it("removes only malformed or invalid current-version records", () => {
    const storage = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: "{broken",
      "other-application": "keep",
    });
    const adapter = createDesktopPreferencesStorage(() => storage);

    expect(adapter.load()).toMatchObject({ type: "invalid", reason: "malformed-json", corruptRecordRemoved: true });
    expect(storage.values.has(DESKTOP_PREFERENCES_STORAGE_KEY)).toBe(false);
    expect(storage.values.get("other-application")).toBe("keep");
  });

  it("preserves unsupported future-version records", () => {
    const futureRecord = JSON.stringify({ version: 99, preferences: tealWithoutIconsOrDate });
    const storage = createMemoryStorage({ [DESKTOP_PREFERENCES_STORAGE_KEY]: futureRecord });

    expect(createDesktopPreferencesStorage(() => storage).load()).toMatchObject({ type: "unsupported-version", version: 99 });
    expect(storage.values.get(DESKTOP_PREFERENCES_STORAGE_KEY)).toBe(futureRecord);
  });

  it("falls back safely when browser storage cannot be obtained or read", () => {
    expect(createDesktopPreferencesStorage(() => null).load().type).toBe("storage-unavailable");
    expect(createDesktopPreferencesStorage(() => { throw new Error("SecurityError"); }).load().type).toBe("storage-unavailable");
    expect(createDesktopPreferencesStorage(() => ({
      getItem() { throw new Error("SecurityError"); },
      setItem() {},
      removeItem() {},
    })).load().type).toBe("read-failed");
  });

  it("writes one namespaced versioned record and tolerates quota or security failures", () => {
    const storage = createMemoryStorage({ "other-application": "keep" });
    const adapter = createDesktopPreferencesStorage(() => storage);

    expect(adapter.save(tealWithoutIconsOrDate)).toEqual({ type: "saved" });
    expect(storage.values.get(DESKTOP_PREFERENCES_STORAGE_KEY)).toBe(serializeDesktopPreferences(tealWithoutIconsOrDate));
    expect(storage.values.get("other-application")).toBe("keep");
    expect(createDesktopPreferencesStorage(() => ({
      getItem() { return null; },
      setItem() { throw new Error("QuotaExceededError"); },
      removeItem() {},
    })).save(tealWithoutIconsOrDate)).toEqual({ type: "write-failed" });
    expect(createDesktopPreferencesStorage(() => null).save(tealWithoutIconsOrDate)).toEqual({ type: "storage-unavailable" });
  });

  it("has controlled persistence notices without browser dialogs or storage clearing", () => {
    const source = readFileSync(new URL("./desktopPreferencesPersistence.ts", import.meta.url), "utf8");

    expect(getDesktopPreferencesPersistenceNotice({ type: "write-failed" })).toContain("could not be saved");
    expect(getDesktopPreferencesPersistenceNotice({ type: "saved" })).toBeNull();
    expect(source).not.toContain("localStorage.clear");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("storage event");
    expect(source).not.toContain("eval(");
    expect(source).not.toContain("Function(");
    expect(source).not.toContain("innerHTML");
  });
});
