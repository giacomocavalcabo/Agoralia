import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en-US/common.json';
import it from './locales/it-IT/common.json';

const fallbackLng = 'en-US';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { common: en },
      'it-IT': { common: it },
    },
    lng: fallbackLng,
    fallbackLng,
    interpolation: { escapeValue: false },
  });

export default i18n;
