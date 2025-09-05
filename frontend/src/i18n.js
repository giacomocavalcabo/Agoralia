import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

function load(locale) {
  return fetch(`/locales/${locale}/common.json`).then((r) => r.json());
}

const fallbackLng = 'en-US';

export const i18nReady = Promise.all([load('en-US'), load('it-IT')]).then(([en, it]) => {
  return i18n.use(initReactI18next).init({
    resources: {
      'en-US': { common: en },
      'it-IT': { common: it },
    },
    lng: fallbackLng,
    fallbackLng,
    interpolation: { escapeValue: false },
  });
});

export default i18n;
