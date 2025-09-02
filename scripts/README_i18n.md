# Scripts i18n Consolidati

Questi script gestiscono completamente il sistema di internazionalizzazione (i18n) del progetto.

## 🔍 Script di CHECK - `i18n_check.py`

**Scopo**: Validare completamente la situazione i18n

**Cosa fa**:
- Scansiona il codice sorgente per estrarre tutte le chiavi di traduzione usate
- Verifica che tutte le chiavi del codice siano presenti nei cataloghi
- Controlla l'allineamento dei placeholder tra codice e cataloghi
- Verifica la completezza dei cataloghi in tutte le lingue target
- Fornisce un report dettagliato dello stato

**Utilizzo**:
```bash
python scripts/i18n_check.py
```

**Output**:
- ✅ Situazione perfetta: tutto allineato
- ❌ Problemi trovati: lista dettagliata di cosa correggere

## 🔄 Script di SYNC - `i18n_sync.py`

**Scopo**: Sincronizzare tutti i cataloghi i18n

**Cosa fa**:
- Scansiona il codice per trovare chiavi mancanti e le aggiunge ai cataloghi inglesi
- Copia la struttura dei cataloghi inglesi in tutte le lingue target
- Mantiene le traduzioni esistenti quando possibile
- Rimuove chiavi extra che non esistono più nel codice
- Allinea i placeholder tra le lingue
- Crea file mancanti per nuove lingue

**Utilizzo**:
```bash
python scripts/i18n_sync.py
```

**Quando usarlo**:
- Dopo aver aggiunto nuove chiavi nel codice
- Prima di tradurre
- Per pulire cataloghi con chiavi obsolete

## 🌍 Script di TRADUZIONE - `i18n_translate.py`

**Scopo**: Tradurre i cataloghi usando DeepL

**Cosa fa**:
- Traduce solo le chiavi mancanti o aggiornate
- Protegge placeholder e termini del glossario dalla traduzione
- Gestisce i limiti di quota DeepL con batching intelligente
- Traccia l'uso mensile dei caratteri
- Retry automatico per errori di rete

**Prerequisiti**:
```bash
export DEEPL_API_KEY="your-deepl-api-key"
```

**Utilizzo**:
```bash
python scripts/i18n_translate.py
```

**Configurazione** (in `i18n.config.json`):
```json
{
  "deepl": {
    "monthly_cap": 500000,
    "soft_warn": 400000,
    "batch_size": 50,
    "max_batch_chars": 20000,
    "max_retries": 3
  }
}
```

## 🔧 Script di SUPPORTO - `i18n_fix_placeholders.py`

**Scopo**: Allineare i placeholder tra le lingue (usato automaticamente da sync)

**Utilizzo** (manuale se necessario):
```bash
python scripts/i18n_fix_placeholders.py --root frontend/public/locales --source en-US
```

## 📋 Workflow Consigliato

### 1. Sviluppo normale
```bash
# Dopo aver aggiunto nuove chiavi nel codice
python scripts/i18n_check.py      # Verifica situazione
python scripts/i18n_sync.py       # Sincronizza cataloghi
python scripts/i18n_translate.py  # Traduci se necessario
```

### 2. Verifica completa
```bash
python scripts/i18n_check.py
```

### 3. Solo sincronizzazione (senza traduzione)
```bash
python scripts/i18n_sync.py
```

### 4. Solo traduzione (se cataloghi già sincronizzati)
```bash
python scripts/i18n_translate.py
```

## 📊 File di Tracking

- `frontend/.i18n/hashes.json` - Hash delle stringhe per rilevare cambiamenti
- `frontend/.i18n/usage.json` - Uso mensile caratteri DeepL
- `frontend/.i18n/placeholder_fix_report.txt` - Report correzioni placeholder

## 🚨 Risoluzione Problemi

### "Chiavi mancanti nei cataloghi"
```bash
python scripts/i18n_sync.py
```

### "Disallineamenti placeholder"
```bash
python scripts/i18n_fix_placeholders.py --root frontend/public/locales
```

### "Limite DeepL raggiunto"
- Aspetta il mese successivo
- Oppure aumenta `DEEPL_MONTHLY_CAP` se hai piano Pro

### "Errori di rete DeepL"
- Script riprova automaticamente
- Verifica connessione internet
- Verifica validità API key

## 📝 Note

- Gli script sono sicuri: non sovrascrivono traduzioni esistenti
- I placeholder sono protetti durante la traduzione
- Il glossario viene preservato
- Uso ottimizzato della quota DeepL
- Backup automatico tramite git prima delle modifiche importanti
