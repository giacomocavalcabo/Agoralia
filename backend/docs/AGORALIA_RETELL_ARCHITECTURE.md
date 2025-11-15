# Architettura Agoralia ↔ Retell AI

## 📋 Panoramica

Agoralia è un sistema **multi-tenant** dove ogni utente/workspace ha un `tenant_id` che isola i dati nel database PostgreSQL su Railway.

Retell AI è un **singolo account** con una singola API key (`RETELL_API_KEY`) che contiene tutte le risorse (agenti, numeri, chiamate) di tutti i tenant di Agoralia.

## 🏗️ Architettura Attuale

### 1. **Database Agoralia (PostgreSQL su Railway)**
```
┌─────────────────────────────────────────────────┐
│  PostgreSQL Database (Agoralia)                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │   users      │  │   agents     │           │
│  │ tenant_id=1  │  │ tenant_id=1  │           │
│  │ tenant_id=2  │  │ retell_id=X  │           │
│  │              │  │              │           │
│  │   numbers    │  │   calls      │           │
│  │ tenant_id=1  │  │ tenant_id=1  │           │
│  │ e164=+1415.. │  │ call_id=Y    │           │
│  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────┘
```

**Isolamento Multi-Tenant:**
- Ogni tabella ha `tenant_id` per isolare i dati
- Query sempre filtrate per `tenant_id` tranne admin
- Ogni tenant vede solo i suoi dati

### 2. **Retell AI (Singolo Account)**
```
┌─────────────────────────────────────────────────┐
│  Retell AI (Singolo Account)                    │
│  ─────────────────────────────────────────────  │
│  API Key: RETELL_API_KEY (unica)                │
│                                                 │
│  Agents:                                        │
│  - agent_abc123 (Tenant 1 - Agente Vendite)    │
│  - agent_def456 (Tenant 2 - Assistenza)        │
│  - agent_ghi789 (Tenant 1 - Qualificazione)    │
│                                                 │
│  Phone Numbers:                                 │
│  - +14157774444 (Tenant 1)                     │
│  - +14157775555 (Tenant 2)                     │
│                                                 │
│  Calls:                                         │
│  - call_xxx (Tenant 1, lead_id=10)            │
│  - call_yyy (Tenant 2, lead_id=20)            │
└─────────────────────────────────────────────────┘
```

**Problema:** Retell AI **non conosce** il concetto di `tenant_id`. Tutte le risorse sono nel singolo account senza isolamento.

## 🔄 Flusso Dati Attuale

### A. **Agoralia → Retell AI (Chiamate API)**

#### 1. **Creazione Agente**
```python
# backend/routes/agents.py
POST /agents
  ↓
tenant_id = extract_tenant_id(request)  # Es: tenant_id=1
  ↓
create_retell_agent(name="Vendite IT", ...)  # API Retell
  ↓
retell_response = {"agent_id": "agent_abc123"}  # Retell risponde
  ↓
Agent(
  tenant_id=1,                    # ✅ Salvato in Agoralia
  retell_agent_id="agent_abc123"  # ✅ Mapping salvato
)
```

**✅ Funziona:** Ogni agente Agoralia ha un `retell_agent_id` che permette di tracciare quale risorsa Retell appartiene a quale tenant.

#### 2. **Creazione Chiamata**
```python
# backend/routes/calls.py
POST /calls/retell/outbound
  ↓
tenant_id = extract_tenant_id(request)  # Es: tenant_id=1
agent = Agent.filter(tenant_id=1, retell_agent_id="agent_abc123")
  ↓
POST Retell API /v2/create-phone-call
{
  "from_number": "+14157774444",
  "to_number": "+393408994869",
  "override_agent_id": "agent_abc123",
  "metadata": {
    "tenant_id": 1,              # ⚠️ IMPORTANTE: salviamo tenant_id nel metadata
    "campaign_id": 5,
    "lead_id": 10
  }
}
  ↓
retell_response = {"call_id": "call_xyz789"}
  ↓
CallRecord(
  tenant_id=1,                    # ✅ Salvato in Agoralia
  provider_call_id="call_xyz789"  # ✅ Mapping salvato
)
```

**✅ Funziona:** Il `tenant_id` viene incluso nel `metadata` della chiamata Retell, permettendo di identificare il tenant quando Retell invia webhook.

#### 3. **Acquisto Numero Telefono**
```python
# backend/routes/calls.py
POST /calls/retell/phone-numbers/create
  ↓
tenant_id = extract_tenant_id(request)  # Es: tenant_id=1
  ↓
POST Retell API /create-phone-number
{
  "area_code": 415,
  "country_code": "US",
  "nickname": "Frontdesk Tenant 1"  # ⚠️ Usiamo nickname per identificare tenant
}
  ↓
retell_response = {"phone_number": "+14157774444"}
  ↓
PhoneNumber(
  tenant_id=1,                    # ✅ Salvato in Agoralia
  e164="+14157774444"            # ✅ Mapping salvato
)
```

**✅ Funziona:** Il numero viene salvato in Agoralia con `tenant_id`, permettendo di sapere quale numero appartiene a quale tenant.

### B. **Retell AI → Agoralia (Webhook)**

#### Problema Attuale ⚠️

```python
# backend/routes/webhooks.py
POST /webhooks/retell
  ↓
payload = {
  "call_id": "call_xyz789",
  "type": "call.ended",
  "metadata": {
    "tenant_id": 1,  # ⚠️ Assumiamo che Retell ci passi il metadata
    "campaign_id": 5
  }
}
  ↓
# ❌ PROBLEMA: Come identifichiamo il tenant?
# Opzione 1: Usare metadata (se presente)
# Opzione 2: Cercare nel database per provider_call_id
```

**❌ Sfida:** Quando Retell invia un webhook, dobbiamo identificare a quale `tenant_id` appartiene la chiamata.

#### Soluzioni Implementate ✅

**1. Lookup nel Database Agoralia:**
```python
# backend/routes/webhooks.py
call_id = payload.get("call_id")  # "call_xyz789"
  ↓
call_record = CallRecord.filter(
  provider_call_id="call_xyz789"
).first()
  ↓
tenant_id = call_record.tenant_id  # ✅ Trovato!
```

**2. Metadata nella Chiamata:**
```python
# Quando creiamo la chiamata, salviamo tenant_id nel metadata
body = {
  "metadata": {
    "tenant_id": tenant_id,  # ✅ Salvato in Retell
    "campaign_id": campaign_id,
    "lead_id": lead_id
  }
}
```

**⚠️ Problema:** I webhook Retell possono non includere il `metadata` originale, o potrebbe essere modificato.

## 📊 Mappatura Risorse

### Tabella di Mapping Attuale

| Risorsa Agoralia | Campo Mapping | Risorsa Retell AI | Identificazione Inversa |
|-----------------|---------------|-------------------|------------------------|
| `Agent` | `retell_agent_id` | `agent_id` | ✅ Query per `retell_agent_id` |
| `PhoneNumber` | `e164` | `phone_number` | ✅ Query per `e164` |
| `CallRecord` | `provider_call_id` | `call_id` | ✅ Query per `provider_call_id` |
| `Campaign` | `from_number_id` | `phone_number` | ⚠️ Indiretto via PhoneNumber |

**✅ Funziona per:**
- Agent: mapping diretto `retell_agent_id` ↔ `agent_id`
- PhoneNumber: mapping diretto `e164` ↔ `phone_number`
- CallRecord: mapping diretto `provider_call_id` ↔ `call_id`

**⚠️ Limiti:**
- Se Retell crea una chiamata senza passare per Agoralia (es. inbound), non abbiamo il mapping
- I webhook devono fare lookup nel database per trovare il `tenant_id`

## 🔍 Identificazione Tenant nei Webhook

### Metodi Attuali

**1. Lookup da CallRecord (Primario)**
```python
# backend/routes/webhooks.py:127
ref_id = payload.get("call_id")  # "call_xyz789"
call_record = session.query(CallRecord).filter(
    CallRecord.provider_call_id == ref_id
).first()
tenant_id = call_record.tenant_id if call_record else None
```

**2. Metadata nella Chiamata (Fallback)**
```python
metadata = payload.get("metadata") or {}
tenant_id = metadata.get("tenant_id")  # Se presente
```

**3. Lookup da PhoneNumber (Per chiamate inbound)**
```python
from_number = payload.get("from_number")  # "+14157774444"
phone_record = session.query(PhoneNumber).filter(
    PhoneNumber.e164 == from_number
).first()
tenant_id = phone_record.tenant_id if phone_record else None
```

## 🚨 Sfide e Problemi

### 1. **Chiamate Inbound Senza Mapping**
**Scenario:** Chiamata in entrata su un numero Retell che non abbiamo ancora mappato in Agoralia.

**Problema:**
- Retell riceve chiamata su `+14157774444`
- Invia webhook `call.started` ad Agoralia
- Agoralia non trova il mapping nel database
- **❌ Non sappiamo a quale tenant appartiene**

**Soluzione Proposta:**
- Impostare `inbound_webhook_url` su ogni numero Retell con `?tenant_id=X` o `?phone_number=+1415...`
- Fare lookup del numero nel database prima di processare il webhook
- Salvare il numero in Agoralia automaticamente quando viene acquistato

### 2. **Agenti Condivisi tra Tenant**
**Scenario:** Un admin vuole condividere un agente tra più tenant.

**Problema:**
- Agent A appartiene a Tenant 1 (`tenant_id=1`)
- Admin vuole usare Agent A anche per Tenant 2
- **❌ Non abbiamo supporto per agenti condivisi**

**Soluzione Proposta:**
- Tabella `agent_tenants` con `agent_id` e `tenant_id` (many-to-many)
- Oppure campo `shared` nell'Agent con lista di `tenant_ids`

### 3. **Numero Telefono Condiviso**
**Scenario:** Un numero può essere usato da più tenant (es. frontdesk comune).

**Problema:**
- PhoneNumber `+14157774444` ha `tenant_id=1`
- Tenant 2 vuole usare lo stesso numero
- **❌ Non supportato**

**Soluzione Proposta:**
- Tabella `phone_number_tenants` con `phone_number_id` e `tenant_id` (many-to-many)
- Oppure `tenant_id=NULL` per numeri condivisi

### 4. **Billing e Costi per Tenant**
**Scenario:** Retell addebita costi all'account Retell, ma Agoralia deve fatturare i tenant.

**Problema:**
- Retell non fornisce breakdown dei costi per tenant
- Agoralia deve tracciare i costi per tenant manualmente

**Soluzione Proposta:**
- Salvare `call_cost` in `CallRecord` con `tenant_id`
- Sommare i costi per tenant per billing
- Usare webhook `call.ended` per aggiornare i costi

## ✅ Best Practices Implementate

### 1. **Salvataggio Mapping in Database**
Ogni risorsa Retell viene salvata in Agoralia con:
- `tenant_id`: Isolamento multi-tenant
- Campo mapping: `retell_agent_id`, `e164`, `provider_call_id`

### 2. **Metadata nella Chiamata Retell**
Quando creiamo chiamate Retell, includiamo:
```json
{
  "metadata": {
    "tenant_id": 1,
    "campaign_id": 5,
    "lead_id": 10
  }
}
```

### 3. **Lookup Multiplo nei Webhook**
Nei webhook Retell, facciamo lookup in questo ordine:
1. `CallRecord.provider_call_id` (più affidabile)
2. `metadata.tenant_id` (fallback)
3. `PhoneNumber.e164` (per inbound)

### 4. **Isolamento Queries**
Tutte le query in Agoralia filtrano per `tenant_id`:
```python
query = session.query(Agent).filter(Agent.tenant_id == tenant_id)
```

## 🔧 Miglioramenti Proposti

### 1. **Webhook URL con Tenant ID**
Impostare `inbound_webhook_url` su ogni numero Retell:
```
https://api.agoralia.app/webhooks/retell?phone_number=+14157774444
```

Poi nel webhook handler:
```python
phone_number = request.query_params.get("phone_number")
phone_record = session.query(PhoneNumber).filter(
    PhoneNumber.e164 == phone_number
).first()
tenant_id = phone_record.tenant_id if phone_record else None
```

### 2. **Tabella di Mapping Centralizzata**
Creare tabella `retell_resource_mapping`:
```sql
CREATE TABLE retell_resource_mapping (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  resource_type VARCHAR(32),  -- 'agent', 'phone_number', 'call'
  retell_id VARCHAR(128),      -- ID in Retell AI
  agoralia_id INT,             -- ID in Agoralia (opzionale)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. **Sincronizzazione Periodica**
Job periodico per sincronizzare risorse Retell → Agoralia:
- Listare tutti gli agenti Retell
- Verificare che esistano in Agoralia
- Creare mapping mancanti

### 4. **Webhook Signature Verification**
Implementare verifica firma webhook Retell:
```python
secret = os.getenv("RETELL_WEBHOOK_SECRET")
signature = request.headers.get("X-Signature")
# Verifica HMAC signature
```

## 📝 Riepilogo

**✅ Cosa Funziona:**
- Mapping risorse Retell ↔ Agoralia tramite ID salvati nel database
- Isolamento multi-tenant tramite `tenant_id` in tutte le tabelle
- Webhook lookup tramite `provider_call_id` per identificare tenant
- Metadata nelle chiamate per tracciare tenant_id
- **✅ Unique indices** su `provider_call_id`, `retell_agent_id`, `e164` per garantire one-to-one mapping
- **✅ Lazy CallRecord creation** nei webhook per gestire inbound/race conditions
- **✅ Idempotency tracking** (`last_event_type`, `last_event_at`) per evitare doppi effetti
- **✅ Billing fields** (`duration_seconds`, `call_cost_cents`) su CallRecord
- **✅ BYO Retell account support** (campo `retell_api_key` su tenants, nullable)
- **✅ Webhook signature verification** con supporto per-tenant secrets

**✅ Miglioramenti Implementati:**
- **Indici e vincoli univoci** su tutti i mapping (garantisce one-to-one Retell ↔ Agoralia)
- **Formalizzato ordine risoluzione tenant** nei webhook con creazione lazy CallRecord
- **Webhook URL con query params** (`phone_number` o `num_token`) come hint, mai come verità
- **Tabelle di join** pronte per agenti/numeri condivisi (`agent_tenants`, `phone_number_tenants`)
- **Billing completo** con tracciamento costi per tenant
- **Idempotenza webhook** per evitare processi duplicati

**🎯 Architettura Finale:**
```
Agoralia (Multi-Tenant)          Retell AI (Singolo Account o BYO)
┌─────────────────────┐          ┌─────────────────────┐
│ Tenant 1            │          │                     │
│ - Agent A → agent_1 │ ───────→ │ agent_1             │
│ - Number +1415      │          │ +14157774444        │
│ retell_api_key?     │          │ call_xxx            │
│                     │          │                     │
│ Tenant 2            │          │                     │
│ - Agent B → agent_2 │ ───────→ │ agent_2             │
│ - Number +1416      │          │ +14157775555        │
│ (default key)       │          │ call_yyy            │
└─────────────────────┘          └─────────────────────┘
         ↑                                │
         │                                │
         └──────── Webhook ───────────────┘
    (call_xxx → Lookup DB → Tenant 1)
    (call_yyy → Create lazy → Tenant 2)
```

## 🚀 Prossimi Passi (Opzionali)

1. **Reconciliation job** per confrontare costi Agoralia vs Retell export
2. **Token opaco** per `num_token` invece di E.164 in query string
3. **Alerting** quando chiamate inbound arrivano senza mapping numero
4. **Audit log** per tutte le operazioni Retell ↔ Agoralia

