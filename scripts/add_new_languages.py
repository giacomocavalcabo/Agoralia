#!/usr/bin/env python3
"""
Script per aggiungere nuove lingue supportate da DeepL API
"""

import os
import shutil
from pathlib import Path

# Lingue attualmente presenti
EXISTING_LANGUAGES = ['en-US', 'it-IT', 'fr-FR', 'es-ES', 'de-DE', 'ar-EG', 'hi-IN']

# Nuove lingue da aggiungere (supportate da DeepL)
NEW_LANGUAGES = [
    'zh-CN',  # Cinese semplificato
    'ja-JP',  # Giapponese
    'ko-KR',  # Coreano
    'pt-BR',  # Portoghese brasiliano
    'ru-RU',  # Russo
    'tr-TR',  # Turco
    'vi-VN',  # Vietnamita
    'th-TH',  # Thailandese
    'id-ID',  # Indonesiano
    'ms-MY',  # Malese
    'he-IL',  # Ebraico
    'pl-PL',  # Polacco
    'nl-NL',  # Olandese
    'sv-SE',  # Svedese
    'no-NO',  # Norvegese
    'da-DK',  # Danese
    'fi-FI',  # Finlandese
    'el-GR',  # Greco
    'cs-CZ',  # Ceco
    'hu-HU',  # Ungherese
    'ro-RO',  # Rumeno
    'bg-BG',  # Bulgaro
    'hr-HR',  # Croato
    'sk-SK',  # Slovacco
    'sl-SI',  # Sloveno
    'et-EE',  # Estone
    'lv-LV',  # Lettone
    'lt-LT',  # Lituano
    'uk-UA',  # Ucraino
]

# Namespace da copiare
NAMESPACES = [
    'admin.json',
    'app.json', 
    'auth.json',
    'billing.json',
    'common.json',
    'compliance.json',
    'errors.json',
    'integrations.json',
    'kb.json',
    'pages.json',
    'settings.json',
    'ui.json'
]

def create_language_directories():
    """Crea le directory per le nuove lingue e copia i file JSON da en-US"""
    
    locales_dir = Path('frontend/public/locales')
    en_us_dir = locales_dir / 'en-US'
    
    if not en_us_dir.exists():
        print("❌ Directory en-US non trovata!")
        return False
    
    created_languages = []
    
    for lang in NEW_LANGUAGES:
        lang_dir = locales_dir / lang
        
        if lang_dir.exists():
            print(f"⚠️  Directory {lang} già esistente, salto...")
            continue
            
        print(f"📁 Creando directory per {lang}...")
        lang_dir.mkdir(exist_ok=True)
        
        # Copia tutti i file JSON da en-US
        for ns in NAMESPACES:
            src_file = en_us_dir / ns
            dst_file = lang_dir / ns
            
            if src_file.exists():
                shutil.copy2(src_file, dst_file)
                print(f"   📄 Copiato {ns}")
            else:
                print(f"   ⚠️  File {ns} non trovato in en-US")
        
        created_languages.append(lang)
    
    print(f"\n✅ Create {len(created_languages)} nuove directory:")
    for lang in created_languages:
        print(f"   - {lang}")
    
    return created_languages

def update_language_switcher():
    """Aggiorna il componente LanguageSwitcher con tutte le lingue"""
    
    # Mappa delle lingue con nomi e bandiere
    language_map = {
        'en-US': {'name': 'English', 'flag': '🇺🇸'},
        'it-IT': {'name': 'Italiano', 'flag': '🇮🇹'},
        'fr-FR': {'name': 'Français', 'flag': '🇫🇷'},
        'es-ES': {'name': 'Español', 'flag': '🇪🇸'},
        'de-DE': {'name': 'Deutsch', 'flag': '🇩🇪'},
        'ar-EG': {'name': 'العربية', 'flag': '🇪🇬'},
        'hi-IN': {'name': 'हिन्दी', 'flag': '🇮🇳'},
        'zh-CN': {'name': '中文', 'flag': '🇨🇳'},
        'ja-JP': {'name': '日本語', 'flag': '🇯🇵'},
        'ko-KR': {'name': '한국어', 'flag': '🇰🇷'},
        'pt-BR': {'name': 'Português', 'flag': '🇧🇷'},
        'ru-RU': {'name': 'Русский', 'flag': '🇷🇺'},
        'tr-TR': {'name': 'Türkçe', 'flag': '🇹🇷'},
        'vi-VN': {'name': 'Tiếng Việt', 'flag': '🇻🇳'},
        'th-TH': {'name': 'ไทย', 'flag': '🇹🇭'},
        'id-ID': {'name': 'Bahasa Indonesia', 'flag': '🇮🇩'},
        'ms-MY': {'name': 'Bahasa Melayu', 'flag': '🇲🇾'},
        'he-IL': {'name': 'עברית', 'flag': '🇮🇱'},
        'pl-PL': {'name': 'Polski', 'flag': '🇵🇱'},
        'nl-NL': {'name': 'Nederlands', 'flag': '🇳🇱'},
        'sv-SE': {'name': 'Svenska', 'flag': '🇸🇪'},
        'no-NO': {'name': 'Norsk', 'flag': '🇳🇴'},
        'da-DK': {'name': 'Dansk', 'flag': '🇩🇰'},
        'fi-FI': {'name': 'Suomi', 'flag': '🇫🇮'},
        'el-GR': {'name': 'Ελληνικά', 'flag': '🇬🇷'},
        'cs-CZ': {'name': 'Čeština', 'flag': '🇨🇿'},
        'hu-HU': {'name': 'Magyar', 'flag': '🇭🇺'},
        'ro-RO': {'name': 'Română', 'flag': '🇷🇴'},
        'bg-BG': {'name': 'Български', 'flag': '🇧🇬'},
        'hr-HR': {'name': 'Hrvatski', 'flag': '🇭🇷'},
        'sk-SK': {'name': 'Slovenčina', 'flag': '🇸🇰'},
        'sl-SI': {'name': 'Slovenščina', 'flag': '🇸🇮'},
        'et-EE': {'name': 'Eesti', 'flag': '🇪🇪'},
        'lv-LV': {'name': 'Latviešu', 'flag': '🇱🇻'},
        'lt-LT': {'name': 'Lietuvių', 'flag': '🇱🇹'},
        'uk-UA': {'name': 'Українська', 'flag': '🇺🇦'},
    }
    
    # Genera il codice JavaScript per l'array languages
    languages_js = "const languages = [\n"
    for lang_code in sorted(language_map.keys()):
        lang_info = language_map[lang_code]
        languages_js += f"  {{ code: '{lang_code}', name: '{lang_info['name']}', flag: '{lang_info['flag']}' }},\n"
    languages_js += "];"
    
    print("\n📝 Codice JavaScript per LanguageSwitcher:")
    print(languages_js)
    
    return languages_js

def update_i18n_config():
    """Aggiorna la configurazione i18n con tutte le lingue supportate"""
    
    all_languages = EXISTING_LANGUAGES + NEW_LANGUAGES
    supported_lngs = '["' + '","'.join(sorted(all_languages)) + '"]'
    
    print(f"\n📝 Configurazione i18n aggiornata:")
    print(f"supportedLngs: {supported_lngs}")
    
    return supported_lngs

if __name__ == "__main__":
    print("🌍 AGGIUNTA NUOVE LINGUE SUPPORTATE DA DEEPL")
    print("=" * 50)
    
    # Crea le directory e copia i file
    created_languages = create_language_directories()
    
    if created_languages:
        # Genera i codici per aggiornare i componenti
        languages_js = update_language_switcher()
        supported_lngs = update_i18n_config()
        
        print(f"\n✅ COMPLETATO!")
        print(f"   - Aggiunte {len(created_languages)} nuove lingue")
        print(f"   - Totale lingue: {len(EXISTING_LANGUAGES) + len(created_languages)}")
        print(f"\n📋 PROSSIMI PASSI:")
        print(f"   1. Aggiorna LanguageSwitcher.jsx con il codice generato")
        print(f"   2. Aggiorna i18n.jsx con supportedLngs")
        print(f"   3. Esegui la traduzione automatica")
    else:
        print("❌ Nessuna nuova lingua creata")
