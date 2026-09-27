import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  areDesktopPreferencesEqual,
  createDesktopPreferencesDraft,
  type DesktopPreferences,
} from "./desktopPreferences";
import {
  createDesktopPreferencesStorage,
  type DesktopPreferencesPersistenceStatus,
  type DesktopPreferencesLoadResult,
  type DesktopPreferencesStorage,
} from "./desktopPreferencesPersistence";
import { DesktopPreferencesContext } from "./desktopPreferencesContextValue";
import { detectSupportedBrowserLocale } from "../i18n/locale";

type DesktopPreferencesProviderProps = {
  readonly children: ReactNode;
  readonly initialPreferences?: DesktopPreferences;
  readonly storage?: DesktopPreferencesStorage;
};

const getInitialPreferences = (startup: DesktopPreferencesLoadResult): DesktopPreferences => {
  if (startup.type === "loaded") {
    return startup.preferences;
  }

  return {
    ...startup.preferences,
    locale: detectSupportedBrowserLocale(
      typeof navigator === "undefined" ? undefined : navigator.languages,
      typeof navigator === "undefined" ? undefined : navigator.language,
    ),
  };
};

export function DesktopPreferencesProvider({
  children,
  initialPreferences,
  storage,
}: DesktopPreferencesProviderProps) {
  const [persistence] = useState(() => storage ?? createDesktopPreferencesStorage());
  const [startup] = useState(() => initialPreferences === undefined
    ? persistence.load()
    : { type: "provided" as const, preferences: initialPreferences });
  const [preferences, setPreferences] = useState<DesktopPreferences>(() => createDesktopPreferencesDraft(
    startup.type === "provided" ? startup.preferences : getInitialPreferences(startup),
  ));
  const [persistenceStatus, setPersistenceStatus] = useState<DesktopPreferencesPersistenceStatus>(startup);

  const applyPreferences = useCallback((next: DesktopPreferences) => {
    const applied = createDesktopPreferencesDraft(next);
    const result = persistence.save(applied);

    setPreferences((current) => areDesktopPreferencesEqual(current, applied) ? current : applied);
    setPersistenceStatus(result);

    return result;
  }, [persistence]);

  const value = useMemo(
    () => ({ preferences, persistenceStatus, applyPreferences }),
    [applyPreferences, persistenceStatus, preferences],
  );

  return <DesktopPreferencesContext.Provider value={value}>{children}</DesktopPreferencesContext.Provider>;
}
