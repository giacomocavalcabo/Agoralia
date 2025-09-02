# Pipeline i18n con DeepL API

Pipeline **100% senza LLM** per la gestione automatica delle traduzioni, basata su DeepL API con validazione e CI che apre automaticamente PR quando cambia l'inglese.

## 🚀 Cosa ottieni

- **Sorgente di verità:** `en-US`
- **Auto-traduzione build-time:** genera/aggiorna `it-IT`, `fr-FR`, `es-ES`, `de-DE`, `ar-EG`
- **Placeholder sicuri:** preserva `{name}`, `{count}`, ecc. (mascherati prima di tradurre)
- **Glossario:** termini brand/feature non vengono tradotti
- **Validator:** fallisce la CI se placeholder non combaciano o mancano chiavi
- **PR automatica:** ogni cambio in `en-US` produce una PR con i JSON aggiornati

## 📁 Struttura file

```
├── i18n.config.json              # Configurazione pipeline
├── scripts/
│   ├── i18n_sync.py             # Script principale DeepL
│   └── i18n_validate.py         # Validatore QA
├── .github/workflows/
│   └── i18n.yml                 # GitHub Action
└── frontend/
    ├── .i18n/                   # Hash per tracking
    └── locales/                  # File traduzioni
```

## ⚙️ Configurazione

### 1. DeepL API Key

Ottieni una API key gratuita da [DeepL](https://www.deepl.com/pro-api) e aggiungila come secret in GitHub:

**GitHub → Settings → Secrets → Actions → `DEEPL_API_KEY`**

### 2. Personalizzazione

Modifica `i18n.config.json` per:
- Cambiare lingue target
- Aggiungere/rimuovere namespace
- Aggiornare glossario
- Modificare pattern placeholder

## 🔧 Comandi locali

```bash
# Sincronizzazione manuale
npm run i18n:sync

# Validazione cataloghi
npm run i18n:validate

# Scanner codice end-to-end
npm run i18n:scan

# Validazione completa
npm run i18n:validate && npm run i18n:scan
```

## 🚀 Workflow automatico

1. **Push su `en-US`** → trigger automatico
2. **DeepL traduce** → preserva placeholder e glossario
3. **Validazione cataloghi** → verifica coerenza tra lingue
4. **Scanner codice** → valida placeholder codice vs cataloghi
5. **PR automatica** → merge e deploy

## 🛡️ Sicurezza

- **Placeholder:** mascherati come `__P0__` prima della traduzione
- **Glossario:** termini brand mascherati come `__GL_0__`
- **Validazione:** fallisce CI se placeholder non corrispondono
- **Fallback:** se DeepL fallisce, mantiene testo inglese
- **End-to-end:** scanner codice valida placeholder passati vs presenti nei cataloghi

## 📊 Supporto lingue DeepL

- ✅ **Europee:** IT, FR, ES, DE, NL, PL, RU, PT, SV, FI, DA, NO, TR, EL, HU, RO, SK, SL, BG
- ✅ **Medio Oriente:** AR, HE, FA
- ✅ **Asiatiche:** JA, ZH, UK, CS
- ✅ **Americhe:** PT-BR

## 🔍 Troubleshooting

### Quota DeepL esaurita
```
❌ DeepL: quota esaurita.
```
- Verifica piano DeepL (gratuito: 500k caratteri/mese)
- Controlla `DEEPL_API_KEY` in GitHub Secrets

### Lingua non supportata
```
❌ DeepL: lingua non supportata
```
- Rimuovi dalla lista `targetLocales` in `i18n.config.json`
- Verifica mapping in `deepl_lang()` function

### Placeholder mismatch
```
[PLACEHOLDERS] it-IT:common.welcome {name} != {nome}
```
- Verifica pattern in `preservePatterns`
- Controlla che placeholder siano identici tra EN e target

## 🔄 Estensioni future

### Google Cloud Translation fallback
```python
# In i18n_sync.py, dopo DeepL fallback
if not translations:
    translations = google_translate_batch(items, target_locale)
```

### DeepL Glossary API (Pro)
```python
# Per coppie EN → XX specifiche
glossary_id = get_deepl_glossary("EN", "IT")
params["glossary_id"] = glossary_id
```

### Runtime translation endpoint
```python
# /api/i18n/suggest endpoint per traduzioni on-demand
@app.post("/i18n/suggest")
async def suggest_translation(text: str, target: str):
    return deepl_translate(text, target)
```

## 📝 Esempi

### Aggiungere nuova chiave
```json
// frontend/locales/en-US/common.json
{
  "welcome": "Welcome to {app_name}",
  "new_feature": "Try our new {feature_name}!",
  "icu_example": "You have {count, plural, one {# message} other {# messages}}",
  "html_example": "Click <0>here</0> to continue"
}
```

### Risultato automatico
```json
// frontend/locales/it-IT/common.json
{
  "welcome": "Benvenuto in {app_name}",
  "new_feature": "Prova la nostra nuova {feature_name}!",
  "icu_example": "Hai {count, plural, one {# messaggio} other {# messaggi}}",
  "html_example": "Clicca <0>qui</0> per continuare"
}
```

### Pattern supportati
- **i18next:** `{name}`, `{count}`, `{{variable}}`
- **ICU:** `{count, plural, one {...} other {...}}`
- **HTML/JSX:** `<0>text</0>`, `<bold>text</bold>`
- **Altri:** `:name`, `%{name}`, `%(name)s`, `${name}`

## 🎯 Best practices

1. **Sempre placeholder:** usa `{variable}` non stringhe hardcoded
2. **Glossario aggiornato:** aggiungi nuovi termini brand
3. **Namespace consistenti:** mantieni struttura identica tra locale
4. **Test locale:** valida sempre prima del push
5. **Review PR:** controlla traduzioni automatiche

---

**Pipeline pronta!** 🎉 

Fai un piccolo change in `en-US`, push e vedrai la magia della PR automatica con DeepL.
