# Report Completo: Agoralia - Architettura e Funzionalità

## 📋 Sommario Esecutivo

**Agoralia** è una piattaforma SaaS **multi-tenant** per la gestione di **campagne di chiamate automatizzate** basate su **Voice AI** (Retell AI). La piattaforma permette agli utenti di:

1. **Configurare agenti vocali AI** (agent)
2. **Gestire knowledge bases** (KB) per fornire informazioni durante le chiamate
3. **Acquistare e gestire numeri telefonici** (phone numbers)
4. **Importare e gestire leads** (contatti)
5. **Creare e lanciare campagne** che combinano i 4 "mattoni" sopra
6. **Monitorare chiamate in tempo reale** con WebSocket
7. **Garantire compliance legale** per paese (DNC, quiet hours, consenso, GDPR)

**Architettura**: Frontend React + Backend FastAPI + PostgreSQL + Retell AI + WebSocket + Redis (opzionale)

---

## 🎯 1. Cosa Fa l'App - Funzionalità Principali

### 1.1 Modello Mentale: "4 Mattoni → Campagna → Monitoraggio"

L'app segue un modello mentale molto chiaro:

```
┌─────────────────────────────────────────────────────────────┐
│                     SETUP (4 Mattoni)                       │
│                                                             │
│  📞 Numero Telefonico  →  📚 Knowledge Base               │
│  🤖 Agent              →  👥 Leads                         │
│                                                             │
│         ↓ (Una volta completato il setup)                  │
│                                                             │
│              🎯 CREA CAMPAGNA                               │
│                                                             │
│         ↓ (Campagna lanciata)                              │
│                                                             │
│              📊 MONITORAGGIO                                │
│         - Chiamate live                                    │
│         - Transcript                                       │
│         - Outcomes/Dispositions                            │
│         - Compliance status                                │
└─────────────────────────────────────────────────────────────┘
```

**Flusso Utente**:
1. **Onboarding**: Setup wizard guida l'utente a configurare i 4 mattoni
2. **Creazione Campagna**: Selezione dei 4 mattoni + configurazione (date, budget, quiet hours)
3. **Lancio**: Campagna parte automaticamente (worker processa `ScheduledCall`)
4. **Monitoraggio**: Dashboard mostra chiamate live, risultati, compliance

### 1.2 Moduli Principali

#### **A. Gestione Agent (Voice AI)**
- Crea agent con nome, lingua, voce (Retell AI)
- Configurazione LLM (GPT-4o-mini), knowledge bases, istruzioni
- Mapping: `Agent.retell_agent_id` ↔ `Retell AI agent_id`
- Supporto BYO Retell account (per tenant)

#### **B. Gestione Knowledge Bases**
- Crea KB con lingua, scope (tenant/global)
- Upload documenti (PDF, TXT) o URL
- Sync con Retell AI (via multipart/form-data)
- Mapping: `KnowledgeBase.retell_kb_id` ↔ `Retell AI knowledge_base_xxx`

#### **C. Gestione Numeri Telefonici**
- Acquista numeri via Retell AI (US, CA, IT supportati)
- Verifica numeri (stato: pending/active/error)
- Configurazione inbound/outbound agents
- Mapping: `PhoneNumber.e164` ↔ `Retell AI phone_number`

#### **D. Gestione Leads**
- Import CSV con contatti (nome, telefono, email, company, nature: b2b/b2c)
- Consenso (consent_status: granted/denied/unknown)
- Assegnazione a campagne
- Quiet hours override per lead (es. contatti personali)

#### **E. Gestione Campagne**
- Crea campagna con:
  - Nome, date (start_date, end_date, timezone)
  - 4 mattoni (number, KB, agent, leads)
  - Budget e limiti (max_calls_per_day, budget_cents)
  - Quiet hours override (campagna > default > country)
- Stati: `draft` → `scheduled` → `running` → `paused`/`completed`/`cancelled`
- Worker processa `ScheduledCall` e chiama Retell API

#### **F. Chiamate e Monitoraggio**
- **Outbound calls**: Chiamate automatiche via Retell API
- **Inbound calls**: Chiamate ricevute su numeri Retell
- **WebSocket**: Eventi in tempo reale (call.started, call.ended, transcript.append)
- **Transcript**: Conversazione completa salvata in `CallSegment`
- **Disposition**: Outcome della chiamata (qualified, not-interested, callback, ecc.)
- **Media**: Audio URL salvato in `CallRecord.audio_url`

#### **G. Compliance e Legal**
- **Country Rules**: Regole per paese (B2B/B2C regime, DNC, quiet hours, AI disclosure)
- **DNC List**: Lista "Do Not Call" per tenant
- **Consent Management**: Consenso per lead (granted/denied/unknown)
- **Quiet Hours**: Vincoli orari per paese/campagna/lead
- **AI Disclosure**: Obbligo disclosure per alcuni paesi
- **Recording Consent**: Base legale per registrazione (consent/legitimate_interest)

---

## 🏗️ 2. Architettura Backend

### 2.1 Stack Tecnologico

```
Backend:
├── FastAPI (Python 3.11+)
├── SQLAlchemy ORM (modelli)
├── PostgreSQL (produzione) / SQLite (dev)
├── Alembic (migrazioni)
├── Retell AI API (Voice AI)
├── Redis (opzionale, per cache/DLQ)
├── WebSocket (eventi real-time)
└── Dramatiq (worker, opzionale)

Frontend:
├── React 18+
├── React Router (routing)
├── Vite (build)
├── i18n (EN/IT)
└── WebSocket client
```

### 2.2 Struttura Directory Backend

```
backend/
├── main.py                  # Entry point FastAPI
├── config/
│   ├── database.py         # DB engine, Base, migrations
│   └── settings.py         # CORS, env vars
├── models/                 # SQLAlchemy models
│   ├── agents.py          # Agent, KB, PhoneNumber
│   ├── campaigns.py       # Campaign, Lead
│   ├── calls.py           # CallRecord, CallSegment, ScheduledCall
│   ├── billing.py         # Plan, Subscription, UsageEvent, Addon, Entitlement
│   ├── compliance.py      # CountryRule, DNCEntry, Consent, CostEvent
│   ├── users.py           # User
│   ├── webhooks.py        # WebhookEvent, WebhookDLQ
│   └── workflows.py       # WorkflowUsage, WorkflowEmailEvent
├── routes/                 # API endpoints
│   ├── auth.py            # /auth/login, /auth/register, /auth/google/start, /auth/me
│   ├── agents.py          # /agents, /kbs, /numbers
│   ├── campaigns.py       # /campaigns, /leads
│   ├── calls.py           # /calls/retell/outbound, /calls/retell/web, /calls/retell/phone-numbers/create
│   ├── webhooks.py        # /webhooks/retell
│   ├── compliance.py      # /compliance/check, /compliance/rules, /compliance/dnc
│   ├── billing.py         # /billing/checkout, /billing/portal, /billing/entitlements
│   └── metrics.py         # /metrics/daily, /metrics/outcomes
├── services/               # Business logic
│   ├── agents.py          # create_retell_agent, update_retell_agent
│   ├── compliance.py      # get_country_rule, get_country_rule_for_number
│   ├── enforcement.py     # check_compliance, enforce_compliance_or_raise, enforce_budget_or_raise
│   └── kb_sync.py         # Sync KB con Retell
├── utils/                  # Utilities
│   ├── retell.py          # retell_get_json, retell_post_json, get_retell_api_key (BYO support)
│   ├── auth.py            # extract_tenant_id, _encode_token, _decode_token
│   ├── tenant.py          # tenant_session (multi-tenant isolation)
│   ├── websocket.py       # WebSocket manager (broadcast events)
│   └── helpers.py         # country_iso_from_e164, _resolve_agent, ecc.
└── alembic/               # Database migrations
```

### 2.3 Multi-Tenancy Architecture

**Isolamento Tenant**:
- Ogni tabella ha `tenant_id` (nullable per admin/system)
- Query sempre filtrate per `tenant_id` (tranne admin)
- `extract_tenant_id(request)` estrae da Bearer token JWT
- `tenant_session(request)` context manager imposta `app.tenant_id` in PostgreSQL

**Mapping Retell ↔ Agoralia**:
- Retell AI è **singolo account** condiviso tra tutti i tenant
- Mapping salvato nel DB Agoralia:
  - `Agent.retell_agent_id` → `Retell agent_id`
  - `PhoneNumber.e164` → `Retell phone_number`
  - `CallRecord.provider_call_id` → `Retell call_id`
- Webhook Retell → Lookup nel DB per trovare `tenant_id`

**BYO Retell Account** (futuro):
- Campo `tenants.retell_api_key` (nullable)
- Se presente, usa quella key invece di globale
- Support per `tenants.retell_webhook_secret` per signature verification

---

## 📊 3. Modelli Dati Principali

### 3.1 Users & Authentication

```python
User:
├── id: int (PK)
├── tenant_id: int (FK → users.id, self-referencing per isolamento)
├── email: str (unique)
├── name: str (nullable)
├── password_salt: str
├── password_hash: str
├── is_admin: int (0/1)
└── created_at: datetime

# JWT Token contiene:
{
  "sub": user.id,
  "tenant_id": user.tenant_id,
  "is_admin": bool,
  "exp": timestamp
}
```

### 3.2 Agents & Knowledge Bases

```python
Agent:
├── id: int (PK)
├── tenant_id: int (nullable)
├── name: str
├── lang: str (es. "it-IT")
├── voice_id: str (es. "11labs-Adrian")
└── retell_agent_id: str (nullable)  # Mapping Retell

KnowledgeBase:
├── id: int (PK)
├── tenant_id: int (nullable)
├── lang: str (es. "it-IT")
├── scope: str ("tenant" | "global")
└── retell_kb_id: str (nullable)  # Mapping Retell

KnowledgeSection:
├── id: int (PK)
├── tenant_id: int (nullable)
├── kb_id: int (FK → kbs.id)
├── kind: str ("knowledge" | "rules" | "style")
└── content_text: str (nullable)

PhoneNumber:
├── id: int (PK)
├── tenant_id: int (nullable)
├── e164: str (es. "+14157774444")
├── type: str ("retell" | "twilio" | ...)
├── verified: int (0/1)
└── country: str (nullable, ISO 3166-1 alpha-2)
```

### 3.3 Campaigns & Leads

```python
Campaign:
├── id: int (PK)
├── tenant_id: int (nullable)
├── name: str
├── status: str ("draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled")
├── agent_id: str (nullable, Retell agent ID)
├── from_number_id: int (nullable, FK → numbers.id)
├── kb_id: int (nullable, FK → kbs.id)
├── start_date: datetime (nullable, timezone-aware)
├── end_date: datetime (nullable, timezone-aware)
├── timezone: str ("UTC" | "Europe/Rome" | ...)
├── quiet_hours_enabled: int (nullable, 0/1/NULL)
├── quiet_hours_weekdays: str (nullable, "09:00-21:00")
├── quiet_hours_saturday: str (nullable, "09:00-21:00" | "forbidden")
├── quiet_hours_sunday: str (nullable, "forbidden" | "09:00-21:00")
├── quiet_hours_timezone: str (nullable)
├── max_calls_per_day: int (nullable)
├── budget_cents: int (nullable)
├── cost_per_call_cents: int (default: 100)
├── calls_made: int (default: 0)
├── calls_successful: int (default: 0)
├── calls_failed: int (default: 0)
├── total_cost_cents: int (default: 0)
└── metadata_json: str (nullable, JSON)

Lead:
├── id: int (PK)
├── tenant_id: int (nullable)
├── name: str
├── company: str (nullable)
├── phone: str (E.164)
├── country_iso: str (nullable, ISO 3166-1 alpha-2)
├── preferred_lang: str (nullable)
├── role: str (nullable, "supplier" | "supplied")
├── nature: str (nullable, "b2b" | "b2c" | "unknown" | "personal")
├── consent_basis: str (nullable)
├── consent_status: str (nullable, "granted" | "denied" | "unknown")
├── campaign_id: int (nullable, FK → campaigns.id)
└── quiet_hours_disabled: int (default: 0, 0/1)
```

### 3.4 Calls & Monitoring

```python
CallRecord:
├── id: int (PK)
├── tenant_id: int (nullable)
├── created_at: datetime
├── updated_at: datetime
├── direction: str ("outbound" | "inbound")
├── provider: str ("retell")
├── to_number: str (nullable, E.164)
├── from_number: str (nullable, E.164)
├── provider_call_id: str (nullable)  # Retell call_id
├── status: str ("created" | "ringing" | "answered" | "ended" | "failed")
├── audio_url: str (nullable)
├── disposition_outcome: str (nullable, "qualified" | "not-interested" | ...)
├── disposition_note: str (nullable)
├── disposition_updated_at: datetime (nullable)
├── media_json: str (nullable, JSON: {"audio_urls": [...]})
├── structured_json: str (nullable, JSON: {"bant": {...}, "trade": {...}})
├── summary_json: str (nullable, JSON: {"bullets": [...]})
├── duration_seconds: int (nullable)
├── call_cost_cents: int (nullable)
├── last_event_type: str (nullable)  # Idempotency tracking
└── last_event_at: datetime (nullable)

CallSegment:
├── id: int (PK)
├── tenant_id: int (nullable)
├── call_id: int (nullable, FK → calls.id)
├── provider_call_id: str (nullable)
├── turn_index: int (nullable)
├── speaker: str ("agent" | "user")
├── start_ms: int (nullable)
├── end_ms: int (nullable)
├── text: str (nullable, transcript)
└── ts: datetime

ScheduledCall:
├── id: int (PK)
├── tenant_id: int (nullable)
├── lead_id: int (nullable)
├── to_number: str (E.164)
├── from_number: str (nullable)
├── agent_id: str (nullable)
├── kb_id: int (nullable)
├── campaign_id: int (nullable, FK → campaigns.id)
├── metadata_json: str (nullable)
├── timezone: str (nullable)
├── scheduled_at: datetime (timezone-aware)
├── status: str ("scheduled" | "queued" | "done" | "canceled")
└── provider_call_id: str (nullable)  # Popolato dopo chiamata Retell
```

### 3.5 Compliance & Billing

```python
CountryRule:
├── id: int (PK)
├── tenant_id: int (nullable)  # NULL = global default
├── country_iso: str (ISO 3166-1 alpha-2)
├── regime_b2b: str ("opt_in" | "opt_out" | "allowed")
├── regime_b2c: str ("opt_in" | "opt_out" | "allowed")
├── dnc_registry_enabled: int (0/1)
├── dnc_registry_name: str (nullable, "RPO" | "Bloctel" | ...)
├── dnc_check_required: int (0/1)
├── quiet_hours_enabled: int (0/1)
├── quiet_hours_weekdays: str (nullable, "09:00-21:00")
├── quiet_hours_saturday: str (nullable, "09:00-21:00" | "forbidden")
├── quiet_hours_sunday: str (nullable, "forbidden" | "09:00-21:00")
├── timezone: str (nullable)
├── ai_disclosure_required: int (0/1)
├── ai_disclosure_note: str (nullable)
├── recording_basis: str ("consent" | "legitimate_interest")
└── metadata_json: str (nullable, JSON con sources/rules)

DNCEntry:
├── id: int (PK)
├── tenant_id: int (nullable)
├── e164: str
└── source: str (nullable, "manual" | "import" | ...)

Consent:
├── id: int (PK)
├── tenant_id: int (nullable)
├── number: str (nullable, E.164)
├── type: str ("marketing" | "recording")
├── status: str ("granted" | "denied")
├── source: str (nullable)
├── proof_url: str (nullable)
└── ts: datetime

Subscription:
├── id: int (PK)
├── tenant_id: int
├── stripe_customer_id: str (nullable)
├── stripe_subscription_id: str (nullable)
├── plan_code: str ("free" | "core" | "pro" | "enterprise")
├── status: str ("active" | "trialing" | "past_due" | "canceled")
├── renews_at: datetime (nullable)
└── cancel_at: datetime (nullable)
```

---

## 🔄 4. Flussi Principali

### 4.1 Autenticazione

```
POST /auth/register
  ↓
1. Crea User con tenant_id=0 (temporaneo)
2. Set tenant_id = user.id (self-referencing)
3. Genera JWT token con {sub, tenant_id, is_admin}
4. Return {token, tenant_id, is_admin}

POST /auth/login
  ↓
1. Verifica email/password (PBKDF2)
2. Genera JWT token
3. Return {token, tenant_id, is_admin}

POST /auth/google/start
  ↓
1. Costruisce OAuth URL Google
2. Return {auth_url}

POST /auth/google/callback
  ↓
1. Exchange code → access_token
2. Decode JWT id_token (senza verifica in MVP)
3. Crea/aggiorna User
4. Genera JWT token Agoralia
5. Return {token, tenant_id, is_admin}

GET /auth/me
  ↓
1. Decode Bearer token
2. Query User da DB
3. Return {user_id, tenant_id, is_admin, email, name}
```

### 4.2 Creazione Agent

```
POST /agents
  ↓
1. extract_tenant_id(request)
2. check_agent_limit(session, tenant_id)  # Verifica plan limits
3. create_retell_agent(name, lang, voice_id) in services/agents.py:
   a. POST /create-retell-llm → retell_llm_id
   b. POST /create-agent con response_engine={type: "retell-llm", llm_id}
   c. Return {agent_id}
4. Crea Agent in DB con retell_agent_id
5. Return {id, name, retell_agent_id}
```

### 4.3 Creazione Knowledge Base

```
POST /kbs
  ↓
1. extract_tenant_id(request)
2. Crea KnowledgeBase in DB
3. Sync con Retell (POST /create-knowledge-base multipart/form-data):
   a. Upload file(s) o testo
   b. Return {knowledge_base_id}
4. Aggiorna KnowledgeBase.retell_kb_id
5. Return {id, retell_kb_id, lang, scope}
```

### 4.4 Acquisto Numero Telefonico

```
POST /calls/retell/phone-numbers/create
  ↓
1. extract_tenant_id(request)
2. POST Retell API /create-phone-number:
   - phone_number (E.164) OR
   - area_code + country_code (US/CA only)
3. Retell return {phone_number}
4. Crea PhoneNumber in DB con e164, tenant_id, verified=1
5. Return {phone_number, ...}
```

### 4.5 Creazione Campagna

```
POST /campaigns
  ↓
1. extract_tenant_id(request)
2. Valida:
   - agent_id esiste in Retell
   - from_number_id esiste e verified=1
   - kb_id esiste e retell_kb_id non NULL
   - start_date/end_date validi
3. Crea Campaign in DB con status="draft"
4. Return {id, name, status, ...}

POST /campaigns/{id}/start
  ↓
1. Verifica status="draft"
2. enforce_compliance_or_raise() per primi lead
3. enforce_budget_or_raise()
4. enforce_subscription_or_raise()
5. Query Leads matching filters
6. Per ogni Lead:
   a. check_compliance() → scheduled_time ottimale
   b. Crea ScheduledCall con scheduled_at
7. Set Campaign.status="running"
8. Worker processa ScheduledCall queue
```

### 4.6 Esecuzione Chiamata (Worker)

```
Worker processa ScheduledCall:
  ↓
1. Query ScheduledCall WHERE status="scheduled" AND scheduled_at <= NOW()
2. Per ogni ScheduledCall:
   a. enforce_compliance_or_raise() (DNC, quiet hours, regime, consent)
   b. enforce_budget_or_raise()
   c. POST Retell API /v2/create-phone-call:
      {
        "from_number": "+14157774444",
        "to_number": "+393491234567",
        "override_agent_id": "agent_abc123",
        "metadata": {
          "tenant_id": 1,  # Per webhook lookup
          "campaign_id": 5,
          "lead_id": 10
        }
      }
   d. Retell return {call_id}
   e. Crea CallRecord in DB con provider_call_id
   f. Aggiorna ScheduledCall.status="queued", provider_call_id
3. Retry logic per chiamate fallite
```

### 4.7 Webhook Retell → Agoralia

```
POST /webhooks/retell?phone_number=+14157774444
  ↓
1. Verifica signature HMAC (per-tenant o global secret)
2. Idempotency check (WebhookEvent.event_id)
3. Risoluzione tenant_id (formale):
   a. PRIMARY: Lookup CallRecord.provider_call_id → tenant_id
   b. FALLBACK: Se CallRecord non esiste:
      - Infer da metadata.tenant_id (hint, non verità)
      - O infer da PhoneNumber.e164 (to_number per inbound)
      - Crea CallRecord "lazy" con tenant_id inferito
4. Processa evento per tipo:
   - call.started → Update CallRecord.status="ringing"
   - call.ended → Update CallRecord.status="ended", duration, cost
   - transcript.append → Crea/aggiorna CallSegment
   - call.analysis_ready → Update CallRecord.summary_json, structured_json
5. Broadcast via WebSocket a tenant_id
6. Mark WebhookEvent.processed=1
```

### 4.8 Compliance Check

```
GET /compliance/check?to_number=+393491234567&lead_id=10&nature=b2b
  ↓
1. country_iso_from_e164(to_number) → "IT"
2. get_country_rule(tenant_id, "IT", session):
   a. Check tenant override in DB
   b. Check global rule in DB
   c. Fallback to compliance.v2.json
3. Load Lead (se lead_id fornito)
4. check_compliance(session, tenant_id, to_number, lead, scheduled_time):
   a. DNC Check: _is_dnc_number() → blocked se in DNC
   b. Quiet Hours: Priority Lead > Campaign > Settings > Country
      - Lead.quiet_hours_disabled=1 → bypass
      - Campaign.quiet_hours_* → use campaign
      - AppSettings.quiet_hours_* → use settings
      - CountryRule.quiet_hours_* → use country
   c. Regime Check: B2B/B2C opt_in/opt_out
      - opt_in: requires Lead.consent_status="granted"
      - opt_out: blocked if Lead.consent_status="denied"
   d. AI Disclosure: Check CountryRule.ai_disclosure_required
   e. Legal Review: Check AppSettings.require_legal_review
5. Return {
     "allowed": bool,
     "country_iso": "IT",
     "nature": "b2b",
     "regime": "opt_out",
     "checks": {...},
     "warnings": [...],
     "block_reason": "..." | None
   }
```

---

## 🔌 5. Integrazioni Esterne

### 5.1 Retell AI Integration

**Base URL**: `https://api.retellai.com` (configurable via `RETELL_BASE_URL`)

**Endpoints Principali**:
- `POST /create-agent` - Crea agent
- `POST /create-retell-llm` - Crea response engine
- `PATCH /update-agent/{agent_id}` - Aggiorna agent
- `DELETE /delete-agent/{agent_id}` - Elimina agent
- `POST /create-knowledge-base` - Crea KB (multipart/form-data)
- `POST /create-phone-number` - Acquista numero
- `POST /v2/create-phone-call` - Crea chiamata outbound
- `POST /create-web-call` - Crea chiamata web (browser)

**Authentication**: `Authorization: Bearer {RETELL_API_KEY}` (o tenant-specific per BYO)

**Webhook**: `POST /webhooks/retell?phone_number=+14157774444`
- Eventi: `call.started`, `call.ended`, `transcript.append`, `call.analysis_ready`
- Signature verification: HMAC-SHA256 con `RETELL_WEBHOOK_SECRET` (o per-tenant)

### 5.2 Multi-Tenant Mapping Strategy

**Problema**: Retell AI è singolo account, Agoralia è multi-tenant.

**Soluzione**:
1. **Mapping nel DB Agoralia**: Ogni risorsa Retell viene salvata con `tenant_id`
2. **Metadata nella chiamata**: `metadata.tenant_id` incluso quando creiamo chiamate Retell
3. **Webhook lookup**: Webhook Retell → Lookup `CallRecord.provider_call_id` → `tenant_id`
4. **Lazy CallRecord creation**: Se CallRecord non esiste (inbound/race), infer tenant_id e crea

**Indici univoci**:
- `Agent.retell_agent_id` UNIQUE
- `PhoneNumber.e164` UNIQUE
- `CallRecord.provider_call_id` UNIQUE

**BYO Retell Account** (futuro):
- Campo `tenants.retell_api_key` (nullable)
- Campo `tenants.retell_webhook_secret` (nullable)
- Se presenti, usa quelli invece di global

### 5.3 WebSocket Events

**WebSocket Manager**: `utils/websocket.py`

**Eventi Broadcast**:
- `call.started` - Chiamata iniziata
- `call.ended` - Chiamata terminata
- `transcript.append` - Nuovo segmento transcript
- `budget.warn` - Budget superato 80%
- `call.analysis_ready` - Analisi chiamata pronta

**Broadcast Scope**: Per `tenant_id` (non globale)

**Frontend Connection**: `wsUrl('/ws?tenant_id=X')` → `wss://api.agoralia.app/ws?...`

### 5.4 Redis (Opzionale)

**Uso**:
- **DLQ (Dead Letter Queue)**: Webhook falliti → `dlq:webhooks:retell`
- **Metrics cache**: `metrics:jobs:started`, `metrics:jobs:succeeded`, ecc.
- **Session storage**: Futuro per multi-instance scaling

**Fallback**: Se Redis non disponibile, usa DB (`WebhookDLQ`) o in-memory (`EVENTS` list)

---

## 📈 6. Metriche e Monitoraggio

### 6.1 Endpoints Metrics

- `GET /metrics/daily` - Chiamate create/completate per giorno
- `GET /metrics/outcomes` - Outcomes chiamate (qualified, not-interested, ecc.)
- `GET /metrics/account/concurrency` - Concorrenza attiva vs limite plan
- `GET /metrics/cost/today` - Costo oggi in EUR
- `GET /metrics/errors/24h` - Errori ultime 24h
- `GET /metrics/jobstats` - Job statistics (da Redis)

### 6.2 Tracking Costi

- `CostEvent`: Ogni evento costo (telephony, LLM, STT, TTS)
- `CallRecord.call_cost_cents`: Costo totale chiamata
- `Campaign.total_cost_cents`: Somma costi chiamate campagna
- Monthly spend: Somma `CostEvent` per mese corrente

---

## 🔒 7. Sicurezza e Compliance

### 7.1 Autenticazione

- **JWT Token**: HMAC-SHA256 con `JWT_SECRET`
- **Password**: PBKDF2-HMAC-SHA256, 100k iterations
- **Google OAuth**: OAuth 2.0 flow, JWT id_token decode (MVP senza verifica)

### 7.2 Isolamento Multi-Tenant

- **Query Filtering**: Tutte le query filtrano per `tenant_id` (tranne admin)
- **PostgreSQL RLS** (futuro): Row Level Security per isolation nativa
- **Tenant ID Source**: Sempre da DB (mai da query params/metadata come verità)

### 7.3 Compliance Enforcement

- **Pre-call checks**: `enforce_compliance_or_raise()` prima di chiamare Retell
- **Blocking reasons**: DNC, quiet hours, regime (opt-in senza consenso), legal review
- **Country rules**: JSON defaults + DB overrides per tenant
- **Audit trail**: `WebhookEvent`, `CallRecord`, `Consent` per audit

---

## 🚀 8. Deployment e Infrastruttura

### 8.1 Backend (Railway)

- **Database**: PostgreSQL su Railway
- **Migrations**: Alembic run automaticamente a startup (`main.py`)
- **Environment**: `.env` con `DATABASE_URL`, `RETELL_API_KEY`, ecc.
- **CORS**: Configurabile via `CORS_ORIGINS`

### 8.2 Frontend (Vercel)

- **Build**: Vite, `npm run build` → `frontend/dist`
- **Routing**: SPA con fallback a `index.html` per tutte le route non-API
- **API Base URL**: `https://api.agoralia.app` (diretta, bypass Vercel proxy)
- **WebSocket**: `wss://api.agoralia.app/ws?...`

### 8.3 Domini

- **Frontend**: `app.agoralia.app` (Vercel)
- **Backend**: `api.agoralia.app` (Railway)

---

## 📝 9. Note e Limitazioni Attuali

### 9.1 MVP Limitations

- **Google OAuth**: JWT id_token decode senza verifica (MVP)
- **DNC Registry**: Check pubblico DNC non implementato (solo lista locale)
- **Worker**: Processo worker non ancora separato (scheduled calls gestiti inline)
- **Redis**: Opzionale, fallback a DB/in-memory

### 9.2 Future Enhancements

- **BYO Retell Account**: Support per tenant con account Retell propri
- **PostgreSQL RLS**: Row Level Security per isolation nativa
- **Worker Separato**: Dramatiq worker per processare ScheduledCall queue
- **CRM Integration**: HubSpot, Salesforce sync
- **Analytics Avanzate**: Grafici, export, reporting

---

## 🎯 10. Conclusioni

**Agoralia** è una piattaforma complessa ma ben strutturata per campagne Voice AI. L'architettura multi-tenant con mapping Retell AI è solida, e il sistema di compliance è robusto. Il modello "4 mattoni → campagna → monitoraggio" è chiaro e scalabile.

**Punti di Forza**:
- ✅ Architettura multi-tenant ben isolata
- ✅ Compliance system completo e configurabile
- ✅ WebSocket per real-time events
- ✅ Support BYO Retell account (futuro)

**Aree di Miglioramento**:
- ⚠️ Worker separato per scheduled calls
- ⚠️ DNC registry integration
- ⚠️ Analytics avanzate
- ⚠️ CRM integrations

Il codice backend è modulare, ben organizzato, e segue best practices (SQLAlchemy, FastAPI, Alembic). Il frontend è stato recentemente resetato per una nuova implementazione pulita basata su UI_STRUCTURE.md e COMPONENTS_MAP.md.

