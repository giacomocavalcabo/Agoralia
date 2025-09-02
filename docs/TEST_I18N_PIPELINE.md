# Test Pipeline i18n 🧪

## Come testare la pipeline

### 1. Setup DeepL API Key

```bash
# Ottieni API key gratuita da: https://www.deepl.com/pro-api
export DEEPL_API_KEY="your-deepl-api-key-here"
```

### 2. Test locale

```bash
# Validazione (sempre funziona)
npm run i18n:validate

# Sincronizzazione (richiede DeepL API key)
npm run i18n:sync
```

### 3. Test con GitHub Actions

1. **Aggiungi secret in GitHub:**
   - Settings → Secrets → Actions → `DEEPL_API_KEY`

2. **Fai un piccolo change in inglese:**
   ```json
   // frontend/locales/en-US/common.json
   {
     "test_key": "This is a test message with {placeholder}"
   }
   ```

3. **Push e watch:**
   ```bash
   git add .
   git commit -m "test: add i18n test key"
   git push
   ```

4. **GitHub Action si attiva automaticamente:**
   - Traduce con DeepL
   - Valida coerenza
   - Crea PR automatica

### 4. Verifica risultati

La PR conterrà:
```json
// frontend/locales/it-IT/common.json
{
  "test_key": "Questo è un messaggio di test con {placeholder}"
}

// frontend/locales/fr-FR/common.json  
{
  "test_key": "Ceci est un message de test avec {placeholder}"
}

// frontend/locales/es-ES/common.json
{
  "test_key": "Este es un mensaje de prueba con {placeholder}"
}
```

### 5. Test placeholder safety

```json
// Inglese
{
  "welcome": "Welcome {user_name} to {app_name}!",
  "count": "You have {count} new messages"
}

// Italiano (generato automaticamente)
{
  "welcome": "Benvenuto {user_name} in {app_name}!",
  "count": "Hai {count} nuovi messaggi"
}
```

### 6. Test glossario

```json
// Inglese  
{
  "brand": "Powered by ColdAI",
  "feature": "Try our new Workspace feature"
}

// Italiano (ColdAI e Workspace non tradotti)
{
  "brand": "Powered by ColdAI", 
  "feature": "Prova la nostra nuova funzionalità Workspace"
}
```

## 🎯 Cosa verificare

✅ **Placeholder preservati:** `{name}` → `{name}`  
✅ **Glossario intatto:** `ColdAI` → `ColdAI`  
✅ **Traduzioni accurate:** DeepL quality  
✅ **PR automatica:** ogni cambio EN  
✅ **Validazione CI:** fallisce se problemi  

## 🚨 Troubleshooting comune

### "DEEPL_API_KEY mancante"
```bash
export DEEPL_API_KEY="your-key"
npm run i18n:sync
```

### "Quota esaurita"
- Verifica piano DeepL (gratuito: 500k/mese)
- Controlla GitHub Secrets

### "Placeholder mismatch"
- Verifica pattern in `i18n.config.json`
- Controlla coerenza tra EN e target

---

**Pipeline testata e funzionante!** 🎉

Ora puoi:
1. Aggiungere `DEEPL_API_KEY` in GitHub Secrets
2. Fare un piccolo change in `en-US`
3. Push e vedere la magia della PR automatica
