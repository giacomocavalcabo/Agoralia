#!/usr/bin/env python3
"""
Test script per verificare l'integrazione con Mailersend
"""

import os
import httpx
import json

def test_mailersend_integration():
    """Test dell'integrazione con Mailersend"""
    
    # Configurazione
    api_key = os.getenv('MAILERSEND_API_KEY')
    if not api_key:
        print("❌ MAILERSEND_API_KEY non configurata")
        return False
    
    # Test email
    test_email = {
        'from': {
            'email': 'noreply@agoralia.ai',
            'name': 'Agoralia Test'
        },
        'to': [{
            'email': 'test@example.com',  # Sostituisci con una email valida per i test
            'name': 'Test User'
        }],
        'subject': 'Test Mailersend Integration',
        'html': '<h1>Test Email</h1><p>Questa è una email di test per verificare l\'integrazione con Mailersend.</p>',
        'text': 'Test Email - Questa è una email di test per verificare l\'integrazione con Mailersend.'
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                'https://api.mailersend.com/v1/email',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json=test_email
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 202:
                print("✅ Email inviata con successo via Mailersend!")
                return True
            else:
                print(f"❌ Errore nell'invio: {response.status_code}")
                print(f"Response Body: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Errore durante il test: {e}")
        return False

def test_mailersend_credentials():
    """Test delle credenziali Mailersend"""
    
    api_key = os.getenv('MAILERSEND_API_KEY')
    if not api_key:
        print("❌ MAILERSEND_API_KEY non configurata")
        return False
    
    try:
        with httpx.Client(timeout=30.0) as client:
            # Test delle credenziali con endpoint di verifica
            response = client.get(
                'https://api.mailersend.com/v1/domains',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                }
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print("✅ Credenziali Mailersend valide!")
                domains = response.json()
                print(f"Domini configurati: {len(domains.get('data', []))}")
                return True
            else:
                print(f"❌ Credenziali non valide: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Errore durante il test delle credenziali: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Test Integrazione Mailersend")
    print("=" * 40)
    
    # Test delle credenziali
    print("\n1. Test Credenziali:")
    creds_ok = test_mailersend_credentials()
    
    if creds_ok:
        print("\n2. Test Invio Email:")
        email_ok = test_mailersend_integration()
        
        if email_ok:
            print("\n🎉 Tutti i test sono passati! Mailersend è configurato correttamente.")
        else:
            print("\n⚠️ Test credenziali OK, ma problema nell'invio email.")
    else:
        print("\n❌ Problema con le credenziali. Verifica MAILERSEND_API_KEY.")
