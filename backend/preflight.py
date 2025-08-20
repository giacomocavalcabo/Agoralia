#!/usr/bin/env python3
"""
Preflight check per Railway - esce SUBITO se mancano env critiche
Evita i retry da 5 minuti quando mancano chiavi essenziali
"""
import os
import sys

def check_required_envs():
    """Controlla le variabili d'ambiente critiche per il boot"""
    
    # Env critiche per il funzionamento base
    REQUIRED = [
        "OPENAI_API_KEY",      # Per le funzionalità AI
        "DATABASE_URL",        # Per il database
        "SECRET_KEY",          # Per JWT/auth
    ]
    
    # Env opzionali ma importanti
    OPTIONAL = [
        "REDIS_URL",           # Per cache/worker (opzionale)
        "STRIPE_SECRET_KEY",   # Per billing (opzionale)
    ]
    
    print("🔍 Preflight check...")
    
    # Controlla env critiche
    missing_critical = [k for k in REQUIRED if not os.getenv(k)]
    if missing_critical:
        print(f"❌ ENV CRITICHE MANCANTI: {', '.join(missing_critical)}")
        print("💡 Aggiungi queste variabili su Railway per far funzionare l'app")
        sys.exit(1)
    
    # Controlla env opzionali
    missing_optional = [k for k in OPTIONAL if not os.getenv(k)]
    if missing_optional:
        print(f"⚠️  ENV OPZIONALI MANCANTI: {', '.join(missing_optional)}")
        print("   L'app funzionerà ma alcune funzionalità saranno limitate")
    
    print("✅ Preflight check completato - tutte le env critiche sono presenti")
    return True

if __name__ == "__main__":
    check_required_envs()
