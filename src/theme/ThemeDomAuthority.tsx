import { useLayoutEffect } from "react";
import { useDesktopPreferences } from "../preferences/useDesktopPreferences";

export function ThemeDomAuthority() {
  const { preferences } = useDesktopPreferences();

  useLayoutEffect(() => {
    document.documentElement.dataset.kdeTheme = preferences.themeId;
  }, [preferences.themeId]);

  return null;
}
