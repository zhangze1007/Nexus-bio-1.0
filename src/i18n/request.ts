/**
 * next-intl request configuration for Next.js App Router.
 *
 * Reads locale from the `NEXT_LOCALE` cookie (set by LanguageSwitcher).
 * Falls back to the Accept-Language header, then to 'en'.
 * Lazy-loads only the messages file for the active locale.
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, locales, type Locale } from './routing';

export default getRequestConfig(async () => {
  const store = await cookies();
  const headerStore = await headers();

  // 1. Cookie (set by LanguageSwitcher)
  const cookieLocale = store.get('NEXT_LOCALE')?.value;

  // 2. Accept-Language header (browser default)
  const acceptLang = headerStore.get('accept-language')?.split(',')[0]?.split('-')[0];

  // 3. Resolve to a supported locale
  let locale: Locale = defaultLocale;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    locale = cookieLocale as Locale;
  } else if (acceptLang && locales.includes(acceptLang as Locale)) {
    locale = acceptLang as Locale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
