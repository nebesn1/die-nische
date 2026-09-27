import { useLayoutEffect, useMemo, type ReactNode } from "react";
import { useDesktopPreferences } from "../preferences/useDesktopPreferences";
import { normalizeDesktopLocale } from "./locale";
import { I18nContext } from "./I18nContext";
import { createTranslator } from "./translate";

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const { preferences } = useDesktopPreferences();
  const locale = normalizeDesktopLocale(preferences.locale);
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
