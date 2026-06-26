/**
 * i18n routing configuration for next-intl.
 *
 * Defines supported locales and the default locale.
 * Used by request.ts and LanguageSwitcher.
 */

export const locales = ['en', 'zh', 'ja'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Human-readable labels for each locale. */
export const localeLabels: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
};

/** Short display names for the switcher button. */
export const localeShortLabels: Record<Locale, string> = {
  en: 'EN',
  zh: 'ZH',
  ja: 'JA',
};
