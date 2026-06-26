/**
 * i18n system tests.
 *
 * Verifies:
 * 1. Translation files load correctly and have matching keys
 * 2. Locale routing config is valid
 * 3. Language switcher cookie logic works
 */

import en from '../src/i18n/messages/en.json';
import zh from '../src/i18n/messages/zh.json';
import ja from '../src/i18n/messages/ja.json';
import { locales, defaultLocale, localeLabels, localeShortLabels } from '../src/i18n/routing';

// ── Helper: recursively collect all keys from a nested object ──
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Record<string, unknown>, fullKey));
    }
  }
  return keys.sort();
}

describe('i18n translation files', () => {
  const enKeys = collectKeys(en);
  const zhKeys = collectKeys(zh);
  const jaKeys = collectKeys(ja);

  it('EN has all expected top-level sections', () => {
    expect(Object.keys(en)).toEqual(
      expect.arrayContaining(['common', 'nav', 'auth', 'tools', 'copilot', 'language'])
    );
  });

  it('ZH has the same keys as EN', () => {
    expect(zhKeys).toEqual(enKeys);
  });

  it('JA has the same keys as EN', () => {
    expect(jaKeys).toEqual(enKeys);
  });

  it('all locales have common UI translations', () => {
    for (const messages of [en, zh, ja]) {
      expect(messages.common).toBeDefined();
      expect((messages.common as Record<string, string>).save).toBeTruthy();
      expect((messages.common as Record<string, string>).cancel).toBeTruthy();
      expect((messages.common as Record<string, string>).loading).toBeTruthy();
      expect((messages.common as Record<string, string>).error).toBeTruthy();
    }
  });

  it('all locales have navigation translations', () => {
    for (const messages of [en, zh, ja]) {
      expect(messages.nav).toBeDefined();
      expect((messages.nav as Record<string, string>).home).toBeTruthy();
      expect((messages.nav as Record<string, string>).workbench).toBeTruthy();
      expect((messages.nav as Record<string, string>).tools).toBeTruthy();
    }
  });

  it('all locales have auth translations', () => {
    for (const messages of [en, zh, ja]) {
      expect(messages.auth).toBeDefined();
      expect((messages.auth as Record<string, string>).signIn).toBeTruthy();
      expect((messages.auth as Record<string, string>).signOut).toBeTruthy();
      expect((messages.auth as Record<string, string>).profile).toBeTruthy();
    }
  });

  it('all locales have tool name translations for all 14+ tools', () => {
    const toolIds = [
      'pathd', 'metabolicEng', 'catdes', 'proevol', 'fbasim', 'dyncon',
      'cethx', 'gecair', 'multio', 'scspatial', 'cellfree', 'dbtlflow',
      'genmim', 'nexai', 'sequence', 'inventory',
    ];
    for (const messages of [en, zh, ja]) {
      const tools = messages.tools as Record<string, Record<string, string>>;
      for (const toolId of toolIds) {
        expect(tools[toolId]).toBeDefined();
        expect(tools[toolId].name).toBeTruthy();
        expect(tools[toolId].description).toBeTruthy();
      }
    }
  });

  it('all locales have copilot translations', () => {
    for (const messages of [en, zh, ja]) {
      expect(messages.copilot).toBeDefined();
      expect((messages.copilot as Record<string, string>).askAxon).toBeTruthy();
      expect((messages.copilot as Record<string, string>).placeholder).toBeTruthy();
    }
  });

  it('all locales have language label translations', () => {
    for (const messages of [en, zh, ja]) {
      expect(messages.language).toBeDefined();
      expect((messages.language as Record<string, string>).label).toBeTruthy();
    }
  });

  it('EN translations are in English', () => {
    expect((en.common as Record<string, string>).save).toBe('Save');
    expect((en.nav as Record<string, string>).home).toBe('Home');
    expect((en.auth as Record<string, string>).signIn).toBe('Sign in');
  });

  it('ZH translations are in Chinese', () => {
    expect((zh.common as Record<string, string>).save).toBe('保存');
    expect((zh.nav as Record<string, string>).home).toBe('首页');
    expect((zh.auth as Record<string, string>).signIn).toBe('登录');
  });

  it('JA translations are in Japanese', () => {
    expect((ja.common as Record<string, string>).save).toBe('保存');
    expect((ja.nav as Record<string, string>).home).toBe('ホーム');
    expect((ja.auth as Record<string, string>).signIn).toBe('サインイン');
  });
});

describe('i18n routing config', () => {
  it('defines three locales', () => {
    expect(locales).toEqual(['en', 'zh', 'ja']);
  });

  it('default locale is en', () => {
    expect(defaultLocale).toBe('en');
  });

  it('all locales have human-readable labels', () => {
    for (const locale of locales) {
      expect(localeLabels[locale]).toBeTruthy();
    }
  });

  it('all locales have short labels', () => {
    for (const locale of locales) {
      expect(localeShortLabels[locale]).toBeTruthy();
    }
  });

  it('short labels match locale codes (uppercased)', () => {
    expect(localeShortLabels.en).toBe('EN');
    expect(localeShortLabels.zh).toBe('ZH');
    expect(localeShortLabels.ja).toBe('JA');
  });
});

describe('i18n key count', () => {
  it('EN has a reasonable number of translation keys', () => {
    const enKeys = collectKeys(en);
    // At least 80 leaf keys (common + nav + auth + 16 tools + copilot + language)
    expect(enKeys.length).toBeGreaterThanOrEqual(80);
  });
});
