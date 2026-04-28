/**
 * Tests for the i18n configuration.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../index';

describe('i18n', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('loads English translations', () => {
    expect(i18n.t('app.name')).toBe('COREVIA');
    expect(i18n.t('nav.dashboard')).toBe('Dashboard');
    expect(i18n.t('auth.login')).toBe('Login');
  });

  it('loads Arabic translations', async () => {
    await i18n.changeLanguage('ar');
    expect(i18n.t('app.name')).toBe('COREVIA');
    expect(i18n.t('nav.dashboard')).toBe('لوحة المعلومات');
    expect(i18n.t('auth.login')).toBe('تسجيل الدخول');
  });

  it('falls back to English for missing keys', () => {
    expect(i18n.t('nonexistent.key')).toBe('Key');
  });

  it('supports interpolation', async () => {
    expect(i18n.t('validation.minLength', { min: 3 })).toBe('Must be at least 3 characters');
  });

  it('lists supported languages', () => {
    const supported = i18n.options.supportedLngs;
    expect(supported).toContain('en');
    expect(supported).toContain('ar');
  });

  it('applies RTL direction for Arabic', async () => {
    await i18n.changeLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('applies LTR direction for English', async () => {
    await i18n.changeLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });
});
