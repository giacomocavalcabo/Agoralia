# Product Specification: Agoralia Voice AI Platform

## 1. Overview

Agoralia è una piattaforma SaaS multi-tenant per la gestione di agenti vocali AI, campagne di chiamate automatizzate e compliance legale per paese. La piattaforma si basa su Retell AI per le chiamate vocali e aggiunge funzionalità avanzate per campagne, gestione numeri telefonici e compliance giuridica.

### 1.1 Architettura Generale

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  - Dashboard, Campagne, Leads, Numeri, Compliance          │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│              Backend API (FastAPI)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Campaigns  │  │  Compliance  │  │ Phone Numbers│    │
│  │   Manager    │  │   Engine     │  │   Manager    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │         Retell AI Integration Layer                 │   │
│  │  - Call API, WebSocket, Webhooks                   │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼────┐  ┌──────▼─────┐  ┌────▼──────┐
│  Retell AI │  │  Database  │  │  Worker   │
│   API      │  │ (Postgres) │  │ (Dramatiq)│
└────────────┘  └────────────┘  └───────────┘
```

---

## 2. Core Features

### 2.1 Voice AI Calls (Retell AI Integration)

#### 2.1.1 API Endpoints

**POST `/api/v1/calls/outbound`**
- Crea una chiamata outbound tramite Retell AI
- **Request:**
  ```json
  {
    "to_number": "+393491234567",
    "from_number": "+14157774444",
    "agent_id": "agent_abc123",
    "metadata": {
      "campaign_id": 123,
      "lead_id": 456,
      "legal_accepted": true,
      "custom_data": {}
    }
  }
  ```
- **Response:**
  ```json
  {
    "call_id": "call_xyz789",
    "status": "queued",
    "provider_call_id": "retell_abc123",
    "estimated_start": "2024-01-15T10:30:00Z"
  }
  ```

**POST `/api/v1/calls/web`**
- Crea una chiamata web (browser-based)
- **Request:**
  ```json
  {
    "agent_id": "agent_abc123",
    "metadata": {}
  }
  ```
- **Response:**
  ```json
  {
    "call_id": "call_web_xyz",
    "websocket_url": "wss://api.retellai.com/...",
    "session_id": "session_123"
  }
  ```

**GET `/api/v1/calls/{call_id}`**
- Recupera dettagli di una chiamata
- **Response:**
  ```json
  {
    "id": 123,
    "call_id": "call_xyz789",
    "status": "completed",
    "direction": "outbound",
    "to_number": "+393491234567",
    "from_number": "+14157774444",
    "duration_seconds": 245,
    "segments": [...],
    "summary": {...},
    "disposition": {...},
    "compliance_status": "approved"
  }
  ```

**GET `/api/v1/calls`
- Lista chiamate con filtri
- **Query params:** `status`, `campaign_id`, `from_date`, `to_date`, `limit`, `offset`
- **Response:**
  ```json
  {
    "total": 150,
    "items": [...],
    "pagination": {
      "limit": 25,
      "offset": 0
    }
  }
  ```

**WebSocket `/api/v1/calls/{call_id}/stream`**
- Stream in tempo reale di eventi chiamata
- Eventi: `call_started`, `segment`, `call_ended`, `compliance_check`

#### 2.1.2 Webhooks Retell AI

**POST `/api/v1/webhooks/retell`**
- Riceve eventi da Retell AI
- Eventi gestiti:
  - `call_started`
  - `call_ended`
  - `call_metadata_updated`
  - `call_analysis_ready`
- Aggiorna `CallRecord` e triggera compliance checks

---

### 2.2 Phone Number Management

#### 2.2.1 Modello Dati

```python
class PhoneNumber(Base):
    id: int
    tenant_id: Optional[int]
    e164: str  # E.164 format: +14157774444
    provider: str  # "retell", "twilio", "vonage"
    provider_number_id: Optional[str]  # ID nel provider
    country: Optional[str]  # ISO 3166-1 alpha-2
    type: str  # "local", "toll-free", "mobile"
    status: str  # "pending", "active", "suspended", "released"
    verified: bool
    capabilities: Dict  # {"voice": true, "sms": false}
    monthly_cost_cents: Optional[int]
    setup_cost_cents: Optional[int]
    created_at: datetime
    updated_at: datetime
```

#### 2.2.2 API Endpoints

**GET `/api/v1/numbers`**
- Lista numeri telefonici del tenant
- **Query params:** `country`, `status`, `provider`
- **Response:**
  ```json
  {
    "items": [
      {
        "id": 1,
        "e164": "+14157774444",
        "country": "US",
        "type": "local",
        "status": "active",
        "provider": "retell",
        "verified": true,
        "capabilities": {"voice": true, "sms": false},
        "monthly_cost_cents": 100
      }
    ]
  }
  ```

**POST `/api/v1/numbers/search`**
- Cerca numeri disponibili per acquisto
- **Request:**
  ```json
  {
    "country": "IT",
    "type": "local",
    "area_code": "02",  # opzionale
    "capabilities": ["voice"]
  }
  ```
- **Response:**
  ```json
  {
    "available_numbers": [
      {
        "e164": "+39021234567",
        "type": "local",
        "monthly_cost_cents": 150,
        "setup_cost_cents": 0
      }
    ]
  }
  ```

**POST `/api/v1/numbers/purchase`**
- Acquista un numero telefonico
- **Request:**
  ```json
  {
    "e164": "+39021234567",
    "provider": "retell",
    "auto_verify": true
  }
  ```
- **Response:**
  ```json
  {
    "number_id": 123,
    "e164": "+39021234567",
    "status": "pending",
    "verification_url": "https://...",  # se necessario
    "estimated_activation": "2024-01-15T12:00:00Z"
  }
  ```

**POST `/api/v1/numbers/{number_id}/verify`**
- Verifica/attiva un numero
- **Request:**
  ```json
  {
    "verification_code": "123456"  # se necessario
  }
  ```

**DELETE `/api/v1/numbers/{number_id}`**
- Rilascia un numero (cancella dal provider e dal DB)

**POST `/api/v1/numbers/{number_id}/configure`**
- Configura un numero (call forwarding, webhooks, etc.)
- **Request:**
  ```json
  {
    "webhook_url": "https://api.agoralia.com/webhooks/retell",
    "call_forwarding": {
      "enabled": false
    }
  }
  ```

#### 2.2.3 Integrazione Provider

**Retell AI Numbers API:**
- Usa Retell AI per numeri US/Canada
- Endpoint: `POST https://api.retellai.com/phone-number`

**Provider Alternativi (futuro):**
- Twilio
- Vonage (Nexmo)
- Bandwidth

---

### 2.3 Campaign Management

#### 2.3.1 Modello Dati

```python
class Campaign(Base):
    id: int
    tenant_id: Optional[int]
    name: str
    status: str  # "draft", "scheduled", "running", "paused", "completed", "cancelled"
    agent_id: Optional[str]  # Retell agent ID
    from_number: Optional[str]  # E.164
    knowledge_base_id: Optional[int]
    
    # Scheduling
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    timezone: str  # "Europe/Rome"
    quiet_hours: Optional[str]  # "21:00-08:00"
    
    # Throttling
    max_calls_per_day: Optional[int]
    max_calls_per_hour: Optional[int]
    spacing_seconds: int  # default 60
    
    # Compliance
    require_legal_review: bool
    country_rules_override: Optional[Dict]  # override regole per paese
    
    # Filters
    lead_filters: Optional[Dict]  # JSON con filtri per leads
    exclude_dnc: bool  # default true
    
    # Metadata
    metadata: Optional[Dict]
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
```

```python
class CampaignExecution(Base):
    id: int
    campaign_id: int
    tenant_id: Optional[int]
    status: str  # "queued", "running", "completed", "failed"
    total_leads: int
    calls_scheduled: int
    calls_completed: int
    calls_failed: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
```

#### 2.3.2 API Endpoints

**GET `/api/v1/campaigns`**
- Lista campagne
- **Query params:** `status`, `limit`, `offset`
- **Response:**
  ```json
  {
    "items": [
      {
        "id": 1,
        "name": "Q1 2024 Outreach",
        "status": "running",
        "agent_id": "agent_abc123",
        "from_number": "+14157774444",
        "start_date": "2024-01-15T09:00:00Z",
        "end_date": "2024-01-31T18:00:00Z",
        "stats": {
          "total_leads": 500,
          "calls_scheduled": 450,
          "calls_completed": 320,
          "calls_failed": 15,
          "completion_rate": 71.1
        }
      }
    ]
  }
  ```

**POST `/api/v1/campaigns`**
- Crea una nuova campagna
- **Request:**
  ```json
  {
    "name": "Q1 2024 Outreach",
    "agent_id": "agent_abc123",
    "from_number": "+14157774444",
    "knowledge_base_id": 5,
    "start_date": "2024-01-15T09:00:00Z",
    "end_date": "2024-01-31T18:00:00Z",
    "timezone": "Europe/Rome",
    "quiet_hours": "21:00-08:00",
    "max_calls_per_day": 100,
    "spacing_seconds": 60,
    "require_legal_review": true,
    "lead_filters": {
      "country_iso": "IT",
      "consent_status": "granted"
    },
    "exclude_dnc": true
  }
  ```
- **Response:**
  ```json
  {
    "id": 1,
    "name": "Q1 2024 Outreach",
    "status": "draft",
    "created_at": "2024-01-10T10:00:00Z"
  }
  ```

**GET `/api/v1/campaigns/{campaign_id}`**
- Dettagli campagna con statistiche

**PATCH `/api/v1/campaigns/{campaign_id}`**
- Aggiorna campagna (solo se status = "draft" o "paused")

**POST `/api/v1/campaigns/{campaign_id}/start`**
- Avvia una campagna
- Valida compliance, verifica numeri, controlla budget
- Crea `CampaignExecution` e schedula chiamate

**POST `/api/v1/campaigns/{campaign_id}/pause`**
- Pausa una campagna in esecuzione

**POST `/api/v1/campaigns/{campaign_id}/resume`**
- Riprende una campagna in pausa

**POST `/api/v1/campaigns/{campaign_id}/stop`**
- Ferma definitivamente una campagna

**GET `/api/v1/campaigns/{campaign_id}/executions`**
- Lista esecuzioni della campagna

**GET `/api/v1/campaigns/{campaign_id}/stats`**
- Statistiche dettagliate:
  ```json
  {
    "total_leads": 500,
    "calls_scheduled": 450,
    "calls_completed": 320,
    "calls_failed": 15,
    "calls_in_progress": 5,
    "calls_queued": 110,
    "completion_rate": 71.1,
    "average_duration_seconds": 245,
    "dispositions": {
      "qualified": 45,
      "not_interested": 120,
      "callback": 30
    },
    "compliance_violations": 2
  }
  ```

#### 2.3.3 Campaign Execution Flow

```
1. User clicks "Start Campaign"
   ↓
2. Backend validates:
   - Campaign status = "draft"
   - Agent ID exists
   - From number is active
   - Budget available
   - Compliance rules valid
   ↓
3. Create CampaignExecution
   ↓
4. Query Leads matching filters
   ↓
5. For each lead:
   a. Check DNC list
   b. Check compliance rules (country, quiet hours, consent)
   c. Calculate optimal call time (timezone, quiet hours)
   d. Create ScheduledCall
   ↓
6. Worker processes ScheduledCall queue:
   - Respects spacing_seconds
   - Checks max_calls_per_hour/day
   - Calls Retell AI API
   - Updates CampaignExecution stats
```

---

### 2.4 Compliance & Legal Rules

#### 2.4.1 Modello Dati

```python
class CountryRule(Base):
    id: int
    tenant_id: Optional[int]
    country_iso: str  # ISO 3166-1 alpha-2
    enabled: bool
    
    # Disclosure requirements
    require_disclosure: bool
    disclosure_text: Optional[str]  # Template
    require_explicit_consent: bool
    
    # DNC (Do Not Call)
    dnc_registry_enabled: bool
    dnc_registry_name: Optional[str]  # "RPO", "Bloctel", etc.
    dnc_check_required: bool
    
    # Quiet hours
    quiet_hours_enabled: bool
    quiet_hours: str  # "21:00-08:00"
    timezone: str  # "Europe/Rome"
    
    # Recording
    require_recording_consent: bool
    recording_disclosure_text: Optional[str]
    
    # Data protection
    gdpr_applicable: bool  # EU countries
    data_retention_days: Optional[int]
    
    # Metadata
    metadata: Optional[Dict]
    created_at: datetime
    updated_at: datetime
```

```python
class ComplianceCheck(Base):
    id: int
    tenant_id: Optional[int]
    call_id: Optional[int]
    campaign_id: Optional[int]
    lead_id: Optional[int]
    to_number: str
    country_iso: str
    
    # Check results
    dnc_check: str  # "passed", "failed", "skipped"
    quiet_hours_check: str
    consent_check: str
    disclosure_check: str
    
    # Overall
    status: str  # "approved", "rejected", "warning"
    rejection_reason: Optional[str]
    
    checked_at: datetime
    checked_by: Optional[str]  # "system", "user_id"
```

#### 2.4.2 API Endpoints

**GET `/api/v1/compliance/rules`**
- Lista regole per paese
- **Query params:** `country_iso`
- **Response:**
  ```json
  {
    "items": [
      {
        "id": 1,
        "country_iso": "IT",
        "enabled": true,
        "require_disclosure": true,
        "disclosure_text": "Questa chiamata è gestita da un agente virtuale AI...",
        "require_explicit_consent": true,
        "dnc_registry_enabled": true,
        "dnc_registry_name": "RPO",
        "quiet_hours": "21:00-08:00",
        "timezone": "Europe/Rome",
        "gdpr_applicable": true
      }
    ]
  }
  ```

**POST `/api/v1/compliance/rules`**
- Crea/aggiorna regola per paese
- **Request:**
  ```json
  {
    "country_iso": "IT",
    "require_disclosure": true,
    "disclosure_text": "...",
    "quiet_hours": "21:00-08:00",
    "dnc_registry_enabled": true
  }
  ```

**GET `/api/v1/compliance/check`**
- Verifica compliance per una chiamata
- **Query params:** `to_number`, `country_iso`, `campaign_id`
- **Response:**
  ```json
  {
    "status": "approved",
    "checks": {
      "dnc": "passed",
      "quiet_hours": "passed",
      "consent": "passed",
      "disclosure": "required"
    },
    "warnings": [],
    "required_actions": [
      {
        "type": "disclosure",
        "text": "Questa chiamata è gestita da un agente virtuale AI..."
      }
    ]
  }
  ```

**POST `/api/v1/compliance/check/pre-call`**
- Pre-check prima di schedulare chiamata
- **Request:**
  ```json
  {
    "to_number": "+393491234567",
    "campaign_id": 1,
    "scheduled_time": "2024-01-15T14:30:00Z"
  }
  ```
- **Response:**
  ```json
  {
    "approved": true,
    "compliance_check_id": 123,
    "warnings": [],
    "required_disclosures": [...]
  }
  ```

**GET `/api/v1/compliance/dnc`**
- Lista numeri DNC
- **Query params:** `country_iso`, `limit`, `offset`

**POST `/api/v1/compliance/dnc`**
- Aggiungi numero a DNC
- **Request:**
  ```json
  {
    "e164": "+393491234567",
    "source": "manual",  # "manual", "registry", "opt_out"
    "country_iso": "IT"
  }
  ```

**DELETE `/api/v1/compliance/dnc/{entry_id}`**
- Rimuovi da DNC

**POST `/api/v1/compliance/dnc/bulk-import`**
- Import CSV di numeri DNC
- **Request:** multipart/form-data con file CSV

#### 2.4.3 Compliance Engine Logic

```python
def check_compliance(
    to_number: str,
    country_iso: str,
    scheduled_time: datetime,
    campaign: Campaign,
    lead: Optional[Lead]
) -> ComplianceCheck:
    """
    Esegue tutti i controlli di compliance per una chiamata
    """
    checks = {
        "dnc": "skipped",
        "quiet_hours": "skipped",
        "consent": "skipped",
        "disclosure": "skipped"
    }
    
    # 1. DNC Check
    if campaign.exclude_dnc:
        if is_dnc_number(to_number, country_iso):
            return ComplianceCheck(status="rejected", rejection_reason="DNC")
        checks["dnc"] = "passed"
    
    # 2. Quiet Hours Check
    rule = get_country_rule(country_iso)
    if rule and rule.quiet_hours_enabled:
        if is_quiet_hours(scheduled_time, rule.quiet_hours, rule.timezone):
            return ComplianceCheck(status="rejected", rejection_reason="Quiet hours")
        checks["quiet_hours"] = "passed"
    
    # 3. Consent Check
    if rule and rule.require_explicit_consent:
        if lead and lead.consent_status != "granted":
            return ComplianceCheck(status="rejected", rejection_reason="No consent")
        checks["consent"] = "passed"
    
    # 4. Disclosure Check
    if rule and rule.require_disclosure:
        checks["disclosure"] = "required"
    
    return ComplianceCheck(status="approved", checks=checks)
```

---

### 2.5 Leads Management

#### 2.5.1 Modello Dati (esteso)

```python
class Lead(Base):
    id: int
    tenant_id: Optional[int]
    campaign_id: Optional[int]
    
    # Contact info
    name: str
    phone: str  # E.164
    email: Optional[str]
    company: Optional[str]
    role: Optional[str]
    
    # Location
    country_iso: Optional[str]
    preferred_lang: Optional[str]  # ISO 639-1
    
    # Consent
    consent_basis: Optional[str]  # "consent", "legitimate_interest", etc.
    consent_status: str  # "unknown", "granted", "denied", "expired"
    consent_date: Optional[datetime]
    consent_source: Optional[str]
    
    # Campaign tracking
    calls_count: int  # default 0
    last_called_at: Optional[datetime]
    last_call_status: Optional[str]
    disposition: Optional[str]
    
    # Metadata
    metadata: Optional[Dict]
    created_at: datetime
    updated_at: datetime
```

#### 2.5.2 API Endpoints (estesi)

**GET `/api/v1/leads`**
- Lista leads con filtri avanzati
- **Query params:** 
  - `campaign_id`, `country_iso`, `consent_status`
  - `q` (search: name, phone, company)
  - `has_been_called`, `disposition`
  - `created_gte`, `created_lte`
  - `limit`, `offset`

**POST `/api/v1/leads`**
- Crea lead
- **Request:**
  ```json
  {
    "name": "Mario Rossi",
    "phone": "+393491234567",
    "email": "mario@example.com",
    "company": "Acme Corp",
    "role": "CTO",
    "country_iso": "IT",
    "preferred_lang": "it",
    "consent_basis": "consent",
    "consent_status": "granted",
    "campaign_id": 1,
    "metadata": {}
  }
  ```

**POST `/api/v1/leads/bulk-import`**
- Import CSV di leads
- **Request:** multipart/form-data
- **Response:**
  ```json
  {
    "imported": 450,
    "failed": 5,
    "errors": [...]
  }
  ```

**GET `/api/v1/leads/{lead_id}/calls`**
- Lista chiamate per un lead

**POST `/api/v1/leads/{lead_id}/call`**
- Chiama immediatamente un lead
- **Request:**
  ```json
  {
    "agent_id": "agent_abc123",
    "from_number": "+14157774444",
    "metadata": {}
  }
  ```

---

## 3. Database Schema

### 3.1 Tabelle Principali

```sql
-- Phone Numbers
CREATE TABLE numbers (
    id SERIAL PRIMARY KEY,
    tenant_id INT,
    e164 VARCHAR(32) NOT NULL,
    provider VARCHAR(16) DEFAULT 'retell',
    provider_number_id VARCHAR(128),
    country VARCHAR(8),
    type VARCHAR(16),  -- 'local', 'toll-free', 'mobile'
    status VARCHAR(16) DEFAULT 'pending',  -- 'pending', 'active', 'suspended', 'released'
    verified BOOLEAN DEFAULT FALSE,
    capabilities JSONB,
    monthly_cost_cents INT,
    setup_cost_cents INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    tenant_id INT,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(16) DEFAULT 'draft',
    agent_id VARCHAR(128),
    from_number VARCHAR(32),
    knowledge_base_id INT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    timezone VARCHAR(64) DEFAULT 'UTC',
    quiet_hours VARCHAR(16),  -- '21:00-08:00'
    max_calls_per_day INT,
    max_calls_per_hour INT,
    spacing_seconds INT DEFAULT 60,
    require_legal_review BOOLEAN DEFAULT TRUE,
    country_rules_override JSONB,
    lead_filters JSONB,
    exclude_dnc BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Campaign Executions
CREATE TABLE campaign_executions (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(id),
    tenant_id INT,
    status VARCHAR(16) DEFAULT 'queued',
    total_leads INT DEFAULT 0,
    calls_scheduled INT DEFAULT 0,
    calls_completed INT DEFAULT 0,
    calls_failed INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

-- Country Rules
CREATE TABLE country_rules (
    id SERIAL PRIMARY KEY,
    tenant_id INT,
    country_iso VARCHAR(8) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    require_disclosure BOOLEAN DEFAULT FALSE,
    disclosure_text TEXT,
    require_explicit_consent BOOLEAN DEFAULT FALSE,
    dnc_registry_enabled BOOLEAN DEFAULT FALSE,
    dnc_registry_name VARCHAR(64),
    dnc_check_required BOOLEAN DEFAULT TRUE,
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours VARCHAR(16),
    timezone VARCHAR(64),
    require_recording_consent BOOLEAN DEFAULT FALSE,
    recording_disclosure_text TEXT,
    gdpr_applicable BOOLEAN DEFAULT FALSE,
    data_retention_days INT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, country_iso)
);

-- Compliance Checks
CREATE TABLE compliance_checks (
    id SERIAL PRIMARY KEY,
    tenant_id INT,
    call_id INT REFERENCES calls(id),
    campaign_id INT REFERENCES campaigns(id),
    lead_id INT REFERENCES leads(id),
    to_number VARCHAR(32),
    country_iso VARCHAR(8),
    dnc_check VARCHAR(16),  -- 'passed', 'failed', 'skipped'
    quiet_hours_check VARCHAR(16),
    consent_check VARCHAR(16),
    disclosure_check VARCHAR(16),
    status VARCHAR(16),  -- 'approved', 'rejected', 'warning'
    rejection_reason TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    checked_by VARCHAR(64)  -- 'system' or user_id
);

-- Scheduled Calls (esteso)
CREATE TABLE scheduled_calls (
    id SERIAL PRIMARY KEY,
    tenant_id INT,
    campaign_id INT REFERENCES campaigns(id),
    lead_id INT REFERENCES leads(id),
    to_number VARCHAR(32) NOT NULL,
    from_number VARCHAR(32),
    agent_id VARCHAR(128),
    kb_id INT,
    metadata_json TEXT,
    timezone VARCHAR(64),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) DEFAULT 'scheduled',  -- 'scheduled', 'queued', 'processing', 'done', 'failed', 'canceled'
    provider_call_id VARCHAR(128),
    compliance_check_id INT REFERENCES compliance_checks(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Worker & Background Jobs

### 4.1 Dramatiq Actors

```python
@dramatiq.actor(max_retries=3, time_limit=300000)
def process_scheduled_call(
    scheduled_call_id: int,
    tenant_id: Optional[int]
):
    """
    Processa una chiamata schedulata:
    1. Verifica compliance
    2. Chiama Retell AI API
    3. Aggiorna status
    """
    pass

@dramatiq.actor(max_retries=2, time_limit=60000)
def start_campaign_execution(
    campaign_id: int,
    tenant_id: Optional[int]
):
    """
    Avvia esecuzione campagna:
    1. Query leads
    2. Filtra per compliance
    3. Crea ScheduledCall per ogni lead
    4. Schedula process_scheduled_call
    """
    pass

@dramatiq.actor(max_retries=1, time_limit=30000)
def sync_retell_call_status(
    call_id: int,
    provider_call_id: str
):
    """
    Sincronizza status chiamata da Retell AI webhook
    """
    pass

@dramatiq.actor(max_retries=2, time_limit=60000)
def purchase_phone_number(
    number_id: int,
    tenant_id: Optional[int]
):
    """
    Acquista numero telefonico dal provider
    """
    pass
```

---

## 5. Integrazione Retell AI

### 5.1 Client SDK

```python
class RetellClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.retellai.com"
    
    def create_phone_call(
        self,
        from_number: str,
        to_number: str,
        agent_id: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        POST /create-phone-call
        """
        pass
    
    def create_web_call(
        self,
        agent_id: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        POST /create-web-call
        """
        pass
    
    def get_call(self, call_id: str) -> Dict:
        """
        GET /get-call/{call_id}
        """
        pass
    
    def list_phone_numbers(
        self,
        country: Optional[str] = None
    ) -> List[Dict]:
        """
        GET /list-phone-numbers
        """
        pass
    
    def purchase_phone_number(
        self,
        e164: str
    ) -> Dict:
        """
        POST /purchase-phone-number
        """
        pass
```

### 5.2 Webhook Handler

```python
@app.post("/api/v1/webhooks/retell")
async def retell_webhook(request: Request):
    """
    Gestisce webhook da Retell AI
    """
    payload = await request.json()
    event_type = payload.get("event")
    
    if event_type == "call_started":
        # Aggiorna CallRecord.status = "in_progress"
        pass
    elif event_type == "call_ended":
        # Aggiorna CallRecord con durata, status
        # Trigger analisi post-chiamata
        pass
    elif event_type == "call_metadata_updated":
        # Aggiorna metadata
        pass
    
    return {"received": True}
```

---

## 6. Frontend Components

### 6.1 Dashboard
- Overview chiamate, campagne, compliance
- KPI cards: calls today, completion rate, compliance violations

### 6.2 Campaigns Page
- Lista campagne con filtri
- Create/Edit campaign form
- Campaign detail con stats e timeline
- Start/Pause/Stop buttons

### 6.3 Phone Numbers Page
- Lista numeri con status
- Search & purchase numbers
- Configure number (webhooks, forwarding)
- Release number

### 6.4 Compliance Page
- Country rules builder (già esistente)
- DNC list management
- Compliance checks history
- Bulk import DNC

### 6.5 Leads Page
- Lista leads con filtri avanzati
- Bulk import CSV
- Quick call button
- Lead detail con history

---

## 7. Security & Multi-tenancy

### 7.1 Authentication
- JWT tokens
- API keys per tenant
- OAuth2 per admin

### 7.2 Authorization
- Tenant isolation: tutte le query filtrano per `tenant_id`
- Role-based access: `admin`, `user`, `viewer`
- Resource-level permissions

### 7.3 Data Isolation
- Database: tutte le tabelle hanno `tenant_id`
- API: `extract_tenant_id(request)` da header/token
- Worker: passa `tenant_id` a tutti gli actors

---

## 8. Monitoring & Analytics

### 8.1 Metrics
- Call success rate
- Average call duration
- Compliance violation rate
- Campaign completion rate
- Cost per call

### 8.2 Logging
- Structured logging (JSON)
- Log levels: DEBUG, INFO, WARNING, ERROR
- Correlation IDs per request

### 8.3 Alerts
- Campaign failures
- High compliance violation rate
- Provider API errors
- Budget exceeded

---

## 9. Roadmap & Future Enhancements

### Phase 1 (MVP)
- ✅ Retell AI integration
- ✅ Basic campaign management
- ✅ Phone number management (Retell only)
- ✅ Compliance rules (IT, FR, US)

### Phase 2
- Multi-provider phone numbers (Twilio, Vonage)
- Advanced campaign scheduling (recurring, A/B testing)
- Real-time compliance dashboard
- Webhook management UI

### Phase 3
- AI-powered lead scoring
- Predictive dialing
- Advanced analytics & reporting
- CRM integrations (HubSpot, Salesforce)

---

## 10. API Versioning

- Base URL: `/api/v1/`
- Versioning strategy: URL-based
- Deprecation: 6 months notice

---

## 11. Error Handling

### 11.1 Error Response Format

```json
{
  "error": {
    "code": "CAMPAIGN_NOT_FOUND",
    "message": "Campaign with ID 123 not found",
    "details": {},
    "request_id": "req_abc123"
  }
}
```

### 11.2 Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `RESOURCE_NOT_FOUND`: Resource doesn't exist
- `PERMISSION_DENIED`: Insufficient permissions
- `COMPLIANCE_VIOLATION`: Call blocked by compliance
- `PROVIDER_ERROR`: Retell AI API error
- `BUDGET_EXCEEDED`: Monthly budget limit reached
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

## 12. Testing Strategy

### 12.1 Unit Tests
- Compliance engine logic
- Campaign scheduling algorithms
- Phone number validation

### 12.2 Integration Tests
- Retell AI API mocking
- Database operations
- Worker job execution

### 12.3 E2E Tests
- Campaign creation → execution → completion
- Compliance check flow
- Phone number purchase flow

---

## 13. Deployment

### 13.1 Infrastructure
- Backend: Railway / Render / AWS
- Database: PostgreSQL (managed)
- Worker: Dramatiq + Redis
- Frontend: Vercel / Netlify

### 13.2 Environment Variables

```bash
# Retell AI
RETELL_API_KEY=xxx

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Stripe
STRIPE_API_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx

# Multi-tenancy
ADMIN_EMAILS=admin@example.com
```

---

## 14. Documentation

### 14.1 API Documentation
- OpenAPI/Swagger spec
- Postman collection
- Code examples (Python, JavaScript)

### 14.2 User Guides
- Getting started
- Campaign setup guide
- Compliance configuration
- Phone number management

---

## 15. Support & SLA

### 15.1 Support Channels
- Email: support@agoralia.com
- In-app chat
- Documentation portal

### 15.2 SLA
- Uptime: 99.9%
- API response time: < 200ms (p95)
- Webhook processing: < 5s

---

**Document Version:** 1.0  
**Last Updated:** 2024-01-15  
**Author:** Agoralia Team

