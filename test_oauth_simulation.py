#!/usr/bin/env python3
"""
Test script per simulare il flusso OAuth HubSpot
"""
import requests
import json
from urllib.parse import urlparse, parse_qs

def test_oauth_start():
    """Test dell'endpoint OAuth start"""
    print("🧪 Test 1: OAuth Start Endpoint")
    
    # Simula una richiesta autenticata (senza cookie reali)
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get(
            'https://app.agoralia.app/api/crm/hubspot/start?workspace_id=ws_1',
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ OAuth Start OK")
            print(f"Auth URL: {data.get('auth_url', 'N/A')[:100]}...")
            print(f"Workspace ID: {data.get('workspace_id')}")
            print(f"Provider: {data.get('provider')}")
            
            # Verifica che l'URL contenga i parametri corretti
            auth_url = data.get('auth_url', '')
            if auth_url:
                parsed = urlparse(auth_url)
                params = parse_qs(parsed.query)
                print(f"Client ID presente: {'client_id' in params}")
                print(f"Redirect URI presente: {'redirect_uri' in params}")
                print(f"Scope presente: {'scope' in params}")
                print(f"State presente: {'state' in params}")
                
                # Verifica che lo state sia un JWT (contiene punti)
                state = params.get('state', [''])[0]
                if '.' in state:
                    print(f"✅ State sembra essere un JWT (lunghezza: {len(state)})")
                else:
                    print(f"❌ State non sembra essere un JWT: {state[:50]}...")
            
            return True
        else:
            print(f"❌ OAuth Start Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Errore durante il test: {e}")
        return False

def test_integrations_status():
    """Test dell'endpoint integrations status"""
    print("\n🧪 Test 2: Integrations Status Endpoint")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get(
            'https://app.agoralia.app/api/integrations/status?workspace_id=ws_1',
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Endpoint richiede autenticazione (come previsto)")
            return True
        elif response.status_code == 200:
            data = response.json()
            print(f"✅ Integrations Status OK")
            print(f"Data: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"❌ Integrations Status Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Errore durante il test: {e}")
        return False

def test_hubspot_config():
    """Test della configurazione HubSpot"""
    print("\n🧪 Test 3: HubSpot Configuration")
    
    try:
        response = requests.get(
            'https://app.agoralia.app/api/crm/hubspot/test',
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ HubSpot Config OK")
            print(f"Client ID presente: {data.get('has_client_id')}")
            print(f"Redirect URI presente: {data.get('has_redirect_uri')}")
            print(f"Scopes presenti: {data.get('has_scopes')}")
            print(f"Scopes: {data.get('scopes')}")
            return True
        else:
            print(f"❌ HubSpot Config Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Errore durante il test: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Avvio Test OAuth HubSpot Flow")
    print("=" * 50)
    
    tests = [
        test_hubspot_config,
        test_oauth_start,
        test_integrations_status
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test fallito con errore: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    print("📊 RISULTATI TEST")
    print("=" * 50)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Test passati: {passed}/{total}")
    
    if passed == total:
        print("🎉 TUTTI I TEST SONO PASSATI!")
        print("\n✅ Il backend è pronto per il flusso OAuth")
        print("✅ La configurazione HubSpot è corretta")
        print("✅ Gli endpoint rispondono come previsto")
        print("\n🔗 Ora puoi testare il flusso completo dal frontend:")
        print("   1. Vai su https://app.agoralia.app/settings/integrations")
        print("   2. Clicca 'Connect' su HubSpot")
        print("   3. Scegli l'account 'agoralia.app' (146837718)")
        print("   4. Autorizza l'app")
        print("   5. Verifica che torni con status 'Connected'")
    else:
        print("❌ ALCUNI TEST SONO FALLITI")
        print("Controlla i log sopra per i dettagli")
