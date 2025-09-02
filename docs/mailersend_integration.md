# Integrazione Mailersend

## Panoramica

Questo documento descrive come configurare e utilizzare Mailersend come provider email nell'applicazione Agoralia.

## Configurazione

### 1. Variabili d'Ambiente

Aggiungi le seguenti variabili al tuo file `.env` o configurazione Railway:

```bash
EMAIL_PROVIDER=mailersend
MAILERSEND_API_KEY=your_mailersend_api_key_here
```

### 2. Domini Verificati

Assicurati che il dominio `agoralia.ai` sia verificato nel tuo account Mailersend. Questo è necessario per inviare email da `noreply@agoralia.ai`.

## Funzionalità

### Provider Supportati

L'applicazione ora supporta tre provider email:

- **Postmark** (`EMAIL_PROVIDER=postmark`)
- **SendGrid** (`EMAIL_PROVIDER=sendgrid`) 
- **Mailersend** (`EMAIL_PROVIDER=mailersend`)

### Switch Automatico

Il sistema sceglie automaticamente il provider basandosi sulla variabile `EMAIL_PROVIDER`:

```python
email_provider = os.getenv('EMAIL_PROVIDER', 'postmark')

if email_provider == 'postmark':
    # Usa Postmark
elif email_provider == 'sendgrid':
    # Usa SendGrid
elif email_provider == 'mailersend':
    # Usa Mailersend
```

## Test

### Test Locale

Per testare l'integrazione localmente:

```bash
cd backend
export MAILERSEND_API_KEY=your_key_here
python test_mailersend.py
```

### Test in Produzione

Il sistema invierà automaticamente email via Mailersend quando:

1. `EMAIL_PROVIDER=mailersend`
2. `MAILERSEND_API_KEY` è configurata correttamente
3. Il dominio è verificato in Mailersend

## Vantaggi di Mailersend

- **Prezzi competitivi**: Spesso più economico di SendGrid per volumi elevati
- **API semplice**: REST API facile da integrare
- **Analytics avanzati**: Tracking dettagliato delle email
- **Supporto multilingua**: Ottimo per applicazioni internazionali
- **Webhook in tempo reale**: Notifiche immediate per bounce, click, etc.

## Troubleshooting

### Errori Comuni

1. **401 Unauthorized**: Verifica che `MAILERSEND_API_KEY` sia corretta
2. **422 Unprocessable Entity**: Verifica che il dominio sia verificato
3. **Rate Limiting**: Mailersend ha limiti di invio per minuto/ora

### Log

I log di invio email sono disponibili in:
- Console del worker Dramatiq
- Log dell'applicazione principale
- Dashboard Mailersend per analytics dettagliati

## Migrazione da Altri Provider

### Da Postmark

```bash
# Cambia solo queste variabili
EMAIL_PROVIDER=mailersend
MAILERSEND_API_KEY=your_key
# Rimuovi POSTMARK_TOKEN
```

### Da SendGrid

```bash
# Cambia solo queste variabili  
EMAIL_PROVIDER=mailersend
MAILERSEND_API_KEY=your_key
# Rimuovi SENDGRID_API_KEY
```

## Supporto

Per problemi con l'integrazione:

1. Controlla i log dell'applicazione
2. Verifica la configurazione delle variabili d'ambiente
3. Testa le credenziali con `test_mailersend.py`
4. Contatta il supporto Mailersend se necessario
