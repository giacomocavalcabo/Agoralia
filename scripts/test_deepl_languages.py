#!/usr/bin/env python3
"""
Script per testare quali lingue sono supportate da DeepL API
"""

import requests
import os

DEEPL_KEY = os.getenv("DEEPL_API_KEY", "d50aa3f9-5118-47eb-bd0f-7006551cbd97:fx")
DEEPL_URL = "https://api-free.deepl.com/v2/translate"

# Lingue da testare
LANGUAGES_TO_TEST = [
    'ar-EG', 'bg-BG', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'es-ES', 'et-EE', 
    'fi-FI', 'fr-FR', 'he-IL', 'hi-IN', 'hr-HR', 'hu-HU', 'id-ID', 'it-IT', 
    'ja-JP', 'ko-KR', 'lt-LT', 'lv-LV', 'ms-MY', 'nl-NL', 'no-NO', 'pl-PL', 
    'pt-BR', 'ro-RO', 'ru-RU', 'sk-SK', 'sl-SI', 'sv-SE', 'th-TH', 'tr-TR', 
    'uk-UA', 'vi-VN', 'zh-CN'
]

def test_language_support(target_lang):
    """Testa se una lingua è supportata da DeepL"""
    try:
        params = {
            'auth_key': DEEPL_KEY,
            'text': 'Hello',
            'source_lang': 'EN',
            'target_lang': target_lang.upper().replace('-', '')
        }
        
        response = requests.post(DEEPL_URL, data=params, timeout=10)
        
        if response.status_code == 200:
            return True, "✅ Supportata"
        elif response.status_code == 400:
            return False, "❌ Non supportata (400)"
        else:
            return False, f"❌ Errore {response.status_code}"
            
    except Exception as e:
        return False, f"❌ Errore: {str(e)}"

def main():
    print("🧪 TEST LINGUE SUPPORTATE DA DEEPL API")
    print("=" * 50)
    
    supported = []
    unsupported = []
    
    for lang in LANGUAGES_TO_TEST:
        print(f"🔍 Testando {lang}...", end=" ")
        is_supported, message = test_language_support(lang)
        print(message)
        
        if is_supported:
            supported.append(lang)
        else:
            unsupported.append(lang)
    
    print(f"\n📊 RISULTATI:")
    print(f"✅ Lingue supportate ({len(supported)}):")
    for lang in supported:
        print(f"   - {lang}")
    
    print(f"\n❌ Lingue NON supportate ({len(unsupported)}):")
    for lang in unsupported:
        print(f"   - {lang}")
    
    print(f"\n💡 Raccomandazione: Usa solo le lingue supportate per evitare errori")

if __name__ == "__main__":
    main()
