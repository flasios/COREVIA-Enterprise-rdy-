/**
 * COREVIA i18n Configuration
 *
 * Provides English (en) and Arabic (ar) translations with RTL support.
 * Uses i18next with browser language detection and react-i18next bindings.
 *
 * Usage:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   return <span>{t('nav.dashboard')}</span>;
 *
 * Language switching:
 *   import { useTranslation } from 'react-i18next';
 *   const { i18n } = useTranslation();
 *   i18n.changeLanguage('ar');   // switches to Arabic + RTL
 *
 * RTL support is automatically applied via document.dir attribute.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ar from './locales/ar.json';

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    parseMissingKeyHandler: (key) => key,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'corevia-lang',
      caches: ['localStorage'],
    },
  });

// Apply RTL/LTR direction on language change
i18n.on('languageChanged', (lng: string) => {
  const dir = RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
});

// Apply initial direction
const initialDir = RTL_LANGUAGES.includes(i18n.language) ? 'rtl' : 'ltr';
document.documentElement.dir = initialDir;
document.documentElement.lang = i18n.language;

export default i18n;
export { RTL_LANGUAGES };
