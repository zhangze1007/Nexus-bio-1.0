"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import { locales, defaultLocale, type Locale } from "../../i18n/routing";

interface I18nProviderProps {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}

/**
 * Client-side i18n provider.
 *
 * Wraps NextIntlClientProvider and syncs the <html lang> attribute
 * when the locale changes (via LanguageSwitcher cookie update + page reload).
 */
export default function I18nProvider({ children, locale, messages }: I18nProviderProps) {
  const resolved: Locale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const [currentLocale, setCurrentLocale] = useState<Locale>(resolved);

  useEffect(() => {
    setCurrentLocale(resolved);
    document.documentElement.lang = resolved;
  }, [resolved]);

  return (
    <NextIntlClientProvider locale={currentLocale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
