# 🚀 Ottimizzazione Railway con Nixpacks

Questo documento spiega come ottimizzare i deploy su Railway per ridurre i tempi di build e i tentativi lenti.

## ✨ Cosa abbiamo implementato

### 1. `nixpacks.toml` - Build ottimizzato
- **Cache persistente** per pip tra i build
- **Installazione mirata** solo da `backend/requirements.txt`
- **Preflight check** per uscire subito se mancano env critiche
- **1 worker** per startup prevedibile

### 2. `backend/preflight.py` - Controlli rapidi
- Verifica **immediata** delle variabili d'ambiente critiche
- **Exit rapido** se mancano chiavi essenziali (no retry da 5 minuti)
- Log chiari per debugging

### 3. Endpoint `/health` - Healthcheck veloce
- Risponde **istantaneamente** senza chiamate esterne
- Perfetto per Railway healthcheck
- Log di boot per debugging

### 4. Requirements separati
- `requirements.txt` - Solo dipendenze runtime
- `dev-requirements.txt` - Dipendenze sviluppo
- Script `pin_requirements.py` per aggiornare automaticamente

## 🚀 Come usare

### 1. Pinnare i requirements (prima volta)
```bash
cd backend
python scripts/pin_requirements.py
```

### 2. Deploy su Railway
```bash
git add .
git commit -m "feat: ottimizzazione Railway con Nixpacks"
git push origin main
```

### 3. Configurazione Railway
- **Builder**: Nixpacks (NON Dockerfile)
- **Healthcheck Path**: `/health`
- **Healthcheck Timeout**: 2-3 secondi

## 📊 Benefici attesi

- **Build time**: Da ~6 minuti a ~1-2 minuti
- **Retry**: Da 5 minuti a fallimento immediato se mancano env
- **Cache**: Pip cache persistente tra build
- **Stabilità**: Startup più prevedibile

## 🔧 Variabili d'ambiente richieste

### Critiche (app non parte senza)
- `OPENAI_API_KEY` - Per funzionalità AI
- `DATABASE_URL` - Per database
- `SECRET_KEY` - Per JWT/auth

### Opzionali (app parte ma funzionalità limitate)
- `REDIS_URL` - Per cache/worker
- `STRIPE_SECRET_KEY` - Per billing

## 🐛 Troubleshooting

### Build fallisce
1. Verifica che `backend/requirements.txt` sia aggiornato
2. Controlla i log di build su Railway
3. Assicurati che il builder sia Nixpacks

### Healthcheck non passa
1. Verifica che `/health` risponda localmente
2. Controlla i log dell'app su Railway
3. Verifica che tutte le env critiche siano presenti

### App si riavvia in loop
1. Controlla `backend/preflight.py` per env mancanti
2. Verifica i log di preflight
3. Aggiungi le variabili d'ambiente mancanti

## 📝 Log utili

### Preflight check
```
🔍 Preflight check...
✅ Preflight check completato - tutte le env critiche sono presenti
```

### Boot completato
```
🚀 Agoralia API starting up...
📅 Boot time: 2025-08-20T14:15:00Z
🔧 Environment: production
✅ Boot OK - app pronta per richieste
```

### Health check
```json
{
  "ok": true,
  "timestamp": "2025-08-20T14:15:00Z"
}
```

## 🔄 Aggiornamento requirements

Quando aggiungi nuove dipendenze:

1. **Runtime**: Aggiungi a `requirements.txt`
2. **Dev**: Aggiungi a `dev-requirements.txt`
3. **Pinnare**: Esegui `python scripts/pin_requirements.py`
4. **Commit**: Fai commit dei file aggiornati

## 💡 Best practices

- **Mantieni requirements.txt stabile** - cambia solo quando necessario
- **Usa sempre Nixpacks** - non passare a Dockerfile
- **Monitora i log** - Railway mostra tutto in tempo reale
- **Testa localmente** - `npm run build` e `uvicorn backend.main:app`
