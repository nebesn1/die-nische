import { germanMessages } from "./messages/de";
import { englishMessages, type TranslationKey, type TranslationMessages } from "./messages/en";
import { simplifiedChineseMessages } from "./messages/zh-CN";
import type { DesktopLocale } from "./locale";

export type TranslationParams = Readonly<Record<string, string | number>>;

const messagesByLocale: Readonly<Record<DesktopLocale, TranslationMessages>> = {
  en: englishMessages,
  "zh-CN": simplifiedChineseMessages,
  de: germanMessages,
};

function interpolate(message: string, params?: TranslationParams): string {
  if (!params) {
    return message;
  }

  return message.replace(/\{([A-Za-z0-9_.-]+)\}/g, (placeholder, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder
  ));
}

export function translateMessageFromMessages(
  localizedMessages: Partial<TranslationMessages>,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const message = localizedMessages[key] ?? englishMessages[key];
  return interpolate(message, params);
}

export function translateMessage(
  locale: DesktopLocale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  return translateMessageFromMessages(messagesByLocale[locale], key, params);
}

export function createTranslator(locale: DesktopLocale) {
  return (key: TranslationKey, params?: TranslationParams): string => translateMessage(locale, key, params);
}
