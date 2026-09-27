import { createContext } from "react";
import { DEFAULT_DESKTOP_LOCALE, type DesktopLocale } from "./locale";
import { createTranslator, type TranslationParams } from "./translate";
import type { TranslationKey } from "./messages/en";

export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

export interface I18nContextValue {
  readonly locale: DesktopLocale;
  readonly t: Translator;
}

export const defaultI18nContextValue: I18nContextValue = {
  locale: DEFAULT_DESKTOP_LOCALE,
  t: createTranslator(DEFAULT_DESKTOP_LOCALE),
};

export const I18nContext = createContext<I18nContextValue>(defaultI18nContextValue);
