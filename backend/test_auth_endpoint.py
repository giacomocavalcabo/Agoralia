#!/usr/bin/env python3
"""
Test script per verificare l'endpoint di autenticazione
"""

import requests
import time
import json

def test_auth_endpoint():
    """Test dell'endpoint /auth/login"""
    
    # Configurazione
    base_url = "https://service-1-production.up.railway.app"
    endpoint = "/auth/login"
    
    # Test data
    test_credentials = {
        "email": "test@example.com",
        "password": "testpassword"
    }
    
    print(f"🧪 Test Endpoint Auth: {base_url}{endpoint}")
    print("=" * 50)
    
    # Test 1: Health check
    print("\n1. 🔍 Health Check")
    try:
        start_time = time.time()
        response = requests.get(f"{base_url}/health", timeout=10)
        health_time = time.time() - start_time
        
        print(f"   Status: {response.status_code}")
        print(f"   Tempo: {health_time:.3f}s")
        print(f"   Response: {response.text[:100]}...")
        
        if response.status_code == 200:
            print("   ✅ Health check OK")
        else:
            print("   ❌ Health check failed")
            
    except Exception as e:
        print(f"   ❌ Health check error: {e}")
        return False
    
    # Test 2: Auth endpoint
    print("\n2. 🔐 Test Auth Endpoint")
    try:
        start_time = time.time()
        response = requests.post(
            f"{base_url}{endpoint}",
            json=test_credentials,
            headers={"Content-Type": "application/json"},
            timeout=15  # Aumentato timeout per debug
        )
        auth_time = time.time() - start_time
        
        print(f"   Status: {response.status_code}")
        print(f"   Tempo: {auth_time:.3f}s")
        print(f"   Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("   ✅ Login successful")
            print(f"   Response: {response.text[:200]}...")
        elif response.status_code == 401:
            print("   ⚠️ Invalid credentials (expected)")
            print(f"   Response: {response.text}")
        else:
            print(f"   ❌ Unexpected status: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print("   ⏰ TIMEOUT: Endpoint non risponde entro 15s")
        print("   🔍 Questo indica un problema nel backend")
        return False
    except Exception as e:
        print(f"   ❌ Auth endpoint error: {e}")
        return False
    
    # Test 3: Performance analysis
    print("\n3. 📊 Performance Analysis")
    if auth_time > 5:
        print(f"   ⚠️ Lento: {auth_time:.3f}s (>5s)")
        print("   🔍 Possibili cause:")
        print("      - Database connection issues")
        print("      - Redis connection issues")
        print("      - Query lente")
        print("      - Rate limiting")
    elif auth_time > 1:
        print(f"   ⚠️ Moderato: {auth_time:.3f}s (>1s)")
    else:
        print(f"   ✅ Veloce: {auth_time:.3f}s")
    
    return True

def test_database_connection():
    """Test della connessione database tramite endpoint CRM"""
    
    print("\n4. 🗄️ Database Connection Test")
    base_url = "https://service-1-production.up.railway.app"
    
    try:
        start_time = time.time()
        response = requests.get(f"{base_url}/crm/health?provider=hubspot", timeout=10)
        db_time = time.time() - start_time
        
        print(f"   Status: {response.status_code}")
        print(f"   Tempo: {db_time:.3f}s")
        
        if response.status_code == 200:
            print("   ✅ Database connection OK")
            data = response.json()
            print(f"   Provider: {data.get('provider', 'N/A')}")
            print(f"   Status: {data.get('status', 'N/A')}")
        else:
            print("   ❌ Database connection failed")
            
    except Exception as e:
        print(f"   ❌ Database test error: {e}")

if __name__ == "__main__":
    print("🚀 Test Backend Authentication")
    print("=" * 50)
    
    # Test principale
    success = test_auth_endpoint()
    
    # Test database
    test_database_connection()
    
    # Risultato finale
    print("\n" + "=" * 50)
    if success:
        print("🎉 Test completato con successo!")
        print("💡 Se il login è lento, controlla i log Railway")
    else:
        print("❌ Test fallito - Controlla i log Railway")
        print("🔍 Possibili problemi:")
        print("   - Backend bloccato")
        print("   - Database connection issues")
        print("   - Redis connection issues")
        print("   - Rate limiting")
    
    print("\n📋 Prossimi passi:")
    print("   1. Controlla i log Railway per errori specifici")
    print("   2. Verifica la connessione database")
    print("   3. Controlla il rate limiter")
    print("   4. Testa localmente se possibile")
