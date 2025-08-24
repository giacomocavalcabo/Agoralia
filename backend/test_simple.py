#!/usr/bin/env python3
"""
Test semplificato per verificare che il backend si avvii senza errori
"""

import os
import sys

# Aggiungi il path corrente per importare main
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_import_main():
    """Test che main.py si importi senza errori"""
    try:
        import main
        print("✅ main.py importato con successo")
        return True
    except Exception as e:
        print(f"❌ Errore importando main.py: {e}")
        return False

def test_app_creation():
    """Test che l'app FastAPI sia creata"""
    try:
        import main
        if hasattr(main, 'app'):
            print("✅ App FastAPI creata con successo")
            return True
        else:
            print("❌ App FastAPI non trovata in main.py")
            return False
    except Exception as e:
        print(f"❌ Errore creando app: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Test semplificato backend...")
    
    success = True
    success &= test_import_main()
    success &= test_app_creation()
    
    if success:
        print("✅ Tutti i test passati!")
        sys.exit(0)
    else:
        print("❌ Alcuni test falliti!")
        sys.exit(1)
