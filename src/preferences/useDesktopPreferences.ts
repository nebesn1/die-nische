import { useContext } from "react";
import {
  DesktopPreferencesContext,
  type DesktopPreferencesContextValue,
} from "./desktopPreferencesContextValue";

export function useDesktopPreferences(): DesktopPreferencesContextValue {
  return useContext(DesktopPreferencesContext);
}
