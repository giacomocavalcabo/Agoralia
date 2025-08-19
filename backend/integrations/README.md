# CRM Integrations - Sprint 9

Questo modulo implementa le integrazioni CRM core per **HubSpot**, **Zoho** e **Odoo** secondo la scaletta Sprint 9.

## Architettura

### Interfaccia Base
- `ClientBase`: Interfaccia astratta per tutti i client CRM
- Metodi standardizzati: `upsert_*`, `pull_*`, `healthcheck`, `validate_credentials`
- Gestione errori: `CrmError`, `RateLimitError`, `AuthenticationError`, `ValidationError`

### Implementazioni Provider

#### HubSpot
- **Autenticazione**: OAuth 2.0
- **API**: REST v3 (`/crm/v3/objects/*`)
- **Oggetti**: Contacts, Companies, Deals, Activities
- **Webhook**: Supporto nativo per `contact.propertyChange`, `company.propertyChange`, `deal.propertyChange`

#### Zoho CRM
- **Autenticazione**: OAuth 2.0 con supporto multi-datacenter
- **API**: REST con moduli Contacts, Accounts, Deals, Activities
- **Datacenter**: US, EU, IN, AU, JP
- **Webhook**: Canale notifiche + fallback polling

#### Odoo
- **Autenticazione**: JSON-RPC con username/password o API key
- **Modelli**: `res.partner`, `crm.lead`, `mail.message`
- **Delta Sync**: Polling su campo `write_date`
- **Self-hosted/Cloud**: Supporto per entrambi

## Utilizzo

### Inizializzazione Client

```python
from integrations import HubSpotClient, ZohoClient, OdooClient

# HubSpot
hs_client = HubSpotClient(workspace_id, {
    "access_token": "token",
    "refresh_token": "refresh",
    "expires_at": "2025-12-31T23:59:59Z",
    "portal_id": "12345"
})

# Zoho
zoho_client = ZohoClient(workspace_id, {
    "client_id": "client_id",
    "client_secret": "secret",
    "refresh_token": "refresh",
    "dc": "EU"  # US, EU, IN, AU, JP
})

# Odoo
odoo_client = OdooClient(workspace_id, {
    "url": "https://instance.odoo.com",
    "database": "db_name",
    "username": "user",
    "password": "pass"
})
```

### Operazioni Base

```python
# Health check
health = await client.healthcheck()

# Upsert entities
contact = await client.upsert_contact({
    "firstname": "John",
    "lastname": "Doe",
    "email": "john@example.com"
})

# Pull data
contacts = await client.pull_contacts({"since": "2025-01-01"})

# Field mapping
mapping = await client.get_field_mapping()
```

## Field Mapping

### Struttura Default

```json
{
  "contact": {
    "email": "email",
    "phone_e164": "phone",
    "first_name": "firstname|First_Name|name (first part)",
    "last_name": "lastname|Last_Name|name (last part)",
    "title": "jobtitle|Title|function",
    "country_iso": "country|Country|country_id",
    "company_id": "company|Account_Name|parent_id"
  },
  "company": {
    "name": "name|Account_Name",
    "domain": "domain|Website|website",
    "phone": "phone|Phone",
    "country_iso": "country|Billing_Country|country_id",
    "vat": "vat_number|VAT|vat",
    "address": "address|Billing_Street|street"
  },
  "deal": {
    "title": "dealname|Deal_Name|name",
    "amount_cents": "amount|Amount|expected_revenue",
    "currency": "currency|Currency|currency_id",
    "stage": "dealstage|Stage|stage_id",
    "pipeline": "pipeline|Pipeline|pipeline_id"
  }
}
```

### Caratteristiche
- **Pipe alternates**: `"A|B|C"` per campi equivalenti
- **Trasformazioni**: `*100` per conversioni (es. centesimi)
- **Picklists**: Supporto per mappature stage/pipeline

## Sincronizzazione

### Job Types
- `crm_pull_delta`: Sincronizzazione incrementale con cursori
- `crm_push_outcomes`: Push esiti chiamate e attività
- `crm_backfill`: Prima sincronizzazione massiva
- `crm_webhook_dispatcher`: Processamento webhook

### Rate Limiting
- **Token Bucket**: Per provider con jitter e backoff esponenziale
- **Retry**: Max 5 tentativi per errori 429/5xx
- **Dead Letter**: Per errori 4xx persistenti

### Idempotenza
- **Idempotency Key**: `hash(provider, object, local_id, payload_signature)`
- **Conflitti**: CRM = fonte per anagrafiche, App = fonte per Activities
- **Merge**: Conservativo per Deal con import stage/currency

## Sicurezza

### Token Storage
- **Cifratura**: Fernet o KMS per token a riposo
- **Rotazione**: Refresh token automatica
- **Scope**: Minimi necessari per operazioni

### Webhook Security
- **Verifica Firma**: HubSpot signature, Zoho secret
- **IP Allowlist**: Per Zoho (se disponibile)
- **Audit**: Log completo di tutte le mutazioni

## Metriche

### Prometheus
- `crm_operations_total`: Contatore operazioni per provider/status
- `crm_sync_duration_seconds`: Istogramma durata sync
- `crm_connection_status`: Gauge stato connessioni
- `crm_rate_limit_hits_total`: Contatore rate limit
- `crm_errors_total`: Contatore errori per tipo

### Logging
- **Strutturato**: JSON con correlation_id
- **Livelli**: info, warn, error
- **Rotazione**: Per workspace e provider

## Testing

### Unit Tests
```bash
cd backend
python test_crm_integrations.py
```

### Integration Tests
- OAuth flow completo
- Pull delta (contatti)
- Push call activity con registrazione

### E2E Tests
1. Connect → Map → Backfill 100 contatti
2. Fare 1 chiamata
3. Push a CRM
4. Verificare activity/deal creati

## Deployment

### Environment Variables
```bash
# HubSpot
CRM_HUBSPOT_CLIENT_ID=...
CRM_HUBSPOT_CLIENT_SECRET=...

# Zoho
CRM_ZOHO_CLIENT_ID=...
CRM_ZOHO_CLIENT_SECRET=...

# Odoo
ODOO_DEFAULT_URL=...
ODOO_DEFAULT_DATABASE=...

# Config
CRM_WEBHOOK_SECRET=...
CRM_SYNC_RATE_LIMIT=5
```

### Railway
- **Builder**: Nixpacks (non Dockerfile)
- **Worker**: `dramatiq backend.workers.crm_jobs`
- **Health Check**: `/crm/health?provider=hubspot`

## Roadmap

### G1 (Completato)
- ✅ Migrazioni + router `/crm/*` consolidato
- ✅ HubSpot adapter (pull/push) + UI Connect

### G2 (In corso)
- 🔄 Mapping Editor + Sync Status
- 🔄 HubSpot webhook + push da Call Detail

### G3-G5 (Prossimi)
- Zoho adapter completo
- Odoo adapter + polling
- QA, metriche, hardening
- Feature-flag rollout controllato

## Troubleshooting

### Errori Comuni

#### Rate Limit (429)
```python
# Retry automatico con backoff
# Verificare CRM_SYNC_RATE_LIMIT in .env
```

#### Authentication (401)
```python
# Token scaduto - refresh automatico
# Verificare scopes e redirect URI
```

#### Mapping Errors (422)
```python
# Verificare struttura mapping_json
# Controllare picklists per stage/pipeline
```

### Log Analysis
```bash
# Filtrare per provider e livello
grep "hubspot.*error" logs/crm_sync.log

# Verificare cursori sync
SELECT * FROM crm_sync_cursors WHERE provider = 'hubspot';
```

## Contributi

### Aggiungere Nuovo Provider
1. Implementare `ClientBase` in `{provider}_client.py`
2. Aggiungere enum in migrazione
3. Aggiornare `CrmSyncService.get_client()`
4. Aggiungere test unitari
5. Documentare mapping default

### Modifiche API
1. Aggiornare interfaccia `ClientBase`
2. Implementare in tutti i provider
3. Aggiornare test
4. Documentare breaking changes
