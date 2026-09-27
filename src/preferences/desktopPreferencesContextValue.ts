import { createContext } from "react";
import {
  DEFAULT_DESKTOP_PREFERENCES,
  type DesktopPreferences,
} from "./desktopPreferences";
import type {
  DesktopPreferencesPersistenceStatus,
  DesktopPreferencesSaveResult,
} from "./desktopPreferencesPersistence";

export interface DesktopPreferencesContextValue {
  readonly preferences: DesktopPreferences;
  readonly persistenceStatus: DesktopPreferencesPersistenceStatus;
  applyPreferences(next: DesktopPreferences): DesktopPreferencesSaveResult;
}

const defaultDesktopPreferencesContextValue: DesktopPreferencesContextValue = {
  preferences: DEFAULT_DESKTOP_PREFERENCES,
  persistenceStatus: { type: "storage-unavailable" },
  applyPreferences: () => ({ type: "storage-unavailable" }),
};

export const DesktopPreferencesContext = createContext<DesktopPreferencesContextValue>(
  defaultDesktopPreferencesContextValue,
);
