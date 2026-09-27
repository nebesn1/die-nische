import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesktopPreferencesProvider } from "./DesktopPreferencesContext";
import {
  DESKTOP_PREFERENCES_STORAGE_KEY,
  createDesktopPreferencesStorage,
  serializeDesktopPreferences,
  type DesktopPreferencesStorageBackend,
} from "./desktopPreferencesPersistence";
import { useDesktopPreferences } from "./useDesktopPreferences";

function PreferenceProbe() {
  const { preferences } = useDesktopPreferences();
  return <output>{`${preferences.backgroundPreset}:${preferences.showDesktopIcons}:${preferences.showClockDate}:${preferences.showTasksFromAllDesktops}:${preferences.konquerorDockOrder}:${preferences.konquerorResourceViewMode}:${preferences.konquerorResourceTreeZoom}:${preferences.konquerorResourceIconZoom}`}</output>;
}

describe("DesktopPreferencesProvider", () => {
  it("provides safe SSR defaults without a Window Manager or VFS dependency", () => {
    const markup = renderToStaticMarkup(<DesktopPreferencesProvider><PreferenceProbe /></DesktopPreferencesProvider>);

    expect(markup).toContain("kde-classic:true:true:false:toolbar-location:tree:normal:normal");
  });

  it("loads an injected persisted value in the lazy initial state", () => {
    const values = new Map([[DESKTOP_PREFERENCES_STORAGE_KEY, serializeDesktopPreferences({
      locale: "en",
      themeId: "kde-classic",
      backgroundPreset: "teal",
      showDesktopIcons: false,
      showClockDate: false,
      lcdClockLook: true,
      showSeconds: false,
      showDayOfWeek: false,
      blinkingClockDots: true,
      showClockFrame: true,
      showTasksFromAllDesktops: true,
      konquerorDockOrder: "location-toolbar",
      konquerorResourceViewMode: "icons",
      konquerorResourceTreeZoom: "small",
      konquerorResourceIconZoom: "large",
    })]]);
    const storage: DesktopPreferencesStorageBackend = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider storage={createDesktopPreferencesStorage(() => storage)}>
        <PreferenceProbe />
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("teal:false:false:true:location-toolbar:icons:small:large");
  });

  it("owns only controlled applied preferences and delegates browser storage to its narrow adapter", () => {
    const source = readFileSync(new URL("./DesktopPreferencesContext.tsx", import.meta.url), "utf8");

    expect(source).toContain("applyPreferences");
    expect(source).toContain("createDesktopPreferencesStorage");
    expect(source).toContain("const [startup] = useState");
    expect(source).toContain("persistence.load()");
    expect(source).toContain("persistence.save(applied)");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("../vfs");
    expect(source).not.toContain("window-manager");
  });
});
