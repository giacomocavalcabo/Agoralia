import React from 'react';
import { useI18n } from '../lib/i18n.jsx';

const languages = [
  { code: 'ar-EG', name: 'العربية', flag: '🇪🇬' },
  { code: 'bg-BG', name: 'Български', flag: '🇧🇬' },
  { code: 'cs-CZ', name: 'Čeština', flag: '🇨🇿' },
  { code: 'da-DK', name: 'Dansk', flag: '🇩🇰' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'el-GR', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
  { code: 'et-EE', name: 'Eesti', flag: '🇪🇪' },
  { code: 'fi-FI', name: 'Suomi', flag: '🇫🇮' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'he-IL', name: 'עברית', flag: '🇮🇱' },
  { code: 'hu-HU', name: 'Magyar', flag: '🇭🇺' },
  { code: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  { code: 'lt-LT', name: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv-LV', name: 'Latviešu', flag: '🇱🇻' },
  { code: 'nb-NO', name: 'Norsk Bokmål', flag: '🇳🇴' },
  { code: 'nl-NL', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl-PL', name: 'Polski', flag: '🇵🇱' },
  { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'pt-PT', name: 'Português (Portugal)', flag: '🇵🇹' },
  { code: 'ro-RO', name: 'Română', flag: '🇷🇴' },
  { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
  { code: 'sk-SK', name: 'Slovenčina', flag: '🇸🇰' },
  { code: 'sl-SI', name: 'Slovenščina', flag: '🇸🇮' },
  { code: 'sv-SE', name: 'Svenska', flag: '🇸🇪' },
  { code: 'th-TH', name: 'ไทย', flag: '🇹🇭' },
  { code: 'tr-TR', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk-UA', name: 'Українська', flag: '🇺🇦' },
  { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh-HANS', name: '中文', flag: '🇨🇳' },
];

export default function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale } = useI18n();
  
  const currentLanguage = languages.find(lang => lang.code === locale) || languages[0];
  
  return (
    <div className={`relative inline-block text-left ${className}`}>
      <div className="group">
        <button
          type="button"
          className="inline-flex items-center justify-center w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          id="language-menu-button"
          aria-expanded="true"
          aria-haspopup="true"
        >
          <span className="mr-2 text-lg">{currentLanguage.flag}</span>
          <span className="hidden sm:inline">{currentLanguage.name}</span>
          <svg className="w-4 h-4 ml-2 -mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        
        <div className="absolute right-0 z-10 w-48 mt-2 origin-top-right bg-white border border-gray-300 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
          <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="language-menu-button">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => setLocale(language.code)}
                className={`${
                  locale === language.code
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                } group flex items-center w-full px-4 py-2 text-sm transition-colors duration-150`}
                role="menuitem"
              >
                <span className="mr-3 text-lg">{language.flag}</span>
                <span className="truncate">{language.name}</span>
                {locale === language.code && (
                  <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


