# Retell AI API Audit - Agoralia

**Data:** 2025-01-15  
**Scopo:** Verificare la copertura completa delle API Retell AI in Agoralia per garantire massima personalizzazione

---

## 📊 Riepilogo Implementazione

| Categoria | Implementato | Parziale | Mancante | Priorità |
|-----------|--------------|----------|----------|----------|
| **Call Management** | 3/6 | 1/6 | 2/6 | 🔴 Alta |
| **Agent Management** | 2/8 | 1/8 | 5/8 | 🔴 Alta |
| **Phone Numbers** | 4/6 | 0/6 | 2/6 | 🟡 Media |
| **Knowledge Base** | 0/6 | 0/6 | 6/6 | 🟡 Media |
| **Conversation Flow** | 0/5 | 0/5 | 5/5 | 🟢 Bassa |
| **Voice Management** | 0/2 | 0/2 | 2/2 | 🟢 Bassa |
| **Batch Calls** | 0/1 | 0/1 | 1/1 | 🟡 Media |
| **Custom Telephony** | 0/2 | 0/2 | 2/2 | 🟡 Media |
| **Chat/SMS** | 0/4 | 0/4 | 4/4 | 🟢 Bassa |
| **Custom LLM** | 0/1 | 0/1 | 1/1 | 🟢 Bassa |

**Totale:** 9/41 implementate completamente (22%), 2/41 parziali (5%), 30/41 mancanti (73%)

---

## 1️⃣ Call Management (V2)

### ✅ Implementato

#### 1.1 POST `/v2/create-phone-call`
- **Status:** ✅ Implementato
- **Endpoint Agoralia:** `POST /calls/retell/outbound`
- **File:** `backend/routes/calls.py:288`
- **Supporta:**
  - ✅ `from_number`, `to_number` (required)
  - ✅ `override_agent_id` (optional)
  - ✅ `metadata` (optional)
  - ⚠️ `override_agent_version` (non supportato)
  - ❌ `agent_override` (solo metadata KB, manca configurazione completa)
  - ❌ `retell_llm_dynamic_variables` (non supportato)
  - ❌ `custom_sip_headers` (non supportato)
  - ❌ `ignore_e164_validation` (non supportato)

**Miglioramenti Necessari:**
- Aggiungere supporto per `agent_override` completo (voice settings, LLM overrides, conversation flow overrides)
- Aggiungere `retell_llm_dynamic_variables` per iniettare variabili dinamiche
- Aggiungere `custom_sip_headers` per provider custom
- Aggiungere `override_agent_version` per versioning

#### 1.2 POST `/v2/create-web-call`
- **Status:** ✅ Implementato
- **Endpoint Agoralia:** `POST /calls/retell/web`
- **File:** `backend/routes/calls.py:477`
- **Supporta:**
  - ✅ `agent_id` (required)
  - ✅ `metadata` (optional)
  - ⚠️ `agent_override` (solo metadata KB, manca configurazione completa)

**Miglioramenti Necessari:**
- Stessi miglioramenti di `create-phone-call` per `agent_override`

#### 1.3 GET `/v2/get-call`
- **Status:** ✅ Implementato
- **Endpoint Agoralia:** `GET /calls/retell/calls/{provider_call_id}`
- **File:** `backend/routes/calls.py:554`

#### 1.4 GET `/v2/list-phone-calls`
- **Status:** ✅ Implementato
- **Endpoint Agoralia:** `GET /calls/retell/calls?limit=50&cursor=...`
- **File:** `backend/routes/calls.py:561`

### ❌ Mancante

#### 1.5 PATCH `/v2/update-call`
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Permette di aggiornare una chiamata in corso (es. transfer, hold)
- **Use Case:** Gestire chiamate attive, transfer, hold/resume
- **Endpoint Proposto:** `PATCH /calls/retell/calls/{provider_call_id}`

#### 1.6 DELETE `/v2/delete-call`
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa
- **Descrizione:** Elimina record chiamata da Retell (non termina chiamata in corso)
- **Use Case:** Pulizia dati, privacy compliance
- **Endpoint Proposto:** `DELETE /calls/retell/calls/{provider_call_id}`

---

## 2️⃣ Agent Management

### ✅ Implementato

#### 2.1 GET `/v2/list-retell-llm` o `/list-retell-llm`
- **Status:** ✅ Implementato (con fallback)
- **Endpoint Agoralia:** `GET /calls/retell/agents`
- **File:** `backend/routes/calls.py:573`

#### 2.2 GET `/v2/get-retell-llm`
- **Status:** ✅ Implementato (con fallback)
- **Endpoint Agoralia:** `GET /calls/retell/agents/{agent_id}`
- **File:** `backend/routes/calls.py:588`

### ❌ Mancante

#### 2.3 POST `/v2/create-retell-llm`
- **Status:** ❌ Non implementato
- **Priorità:** 🔴 Alta
- **Descrizione:** Crea nuovo agente Retell LLM (single/multi prompt)
- **Use Case:** Creazione agenti dinamici da Agoralia, multi-lingua, personalizzazione voice
- **Endpoint Proposto:** `POST /calls/retell/agents`
- **Parametri Chiave:**
  - `response_engine` (retell-llm config)
  - `agent_name`, `voice_id`, `voice_model`
  - `language`, `webhook_url`
  - `knowledge_base_ids`
  - `dynamic_variables`

#### 2.4 PATCH `/v2/update-retell-llm`
- **Status:** ❌ Non implementato
- **Priorità:** 🔴 Alta
- **Descrizione:** Aggiorna configurazione agente esistente
- **Use Case:** Modifica prompt, cambio voce, aggiornamento KB
- **Endpoint Proposto:** `PATCH /calls/retell/agents/{agent_id}`

#### 2.5 DELETE `/v2/delete-retell-llm`
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Elimina agente da Retell
- **Use Case:** Pulizia agenti non utilizzati
- **Endpoint Proposto:** `DELETE /calls/retell/agents/{agent_id}`

#### 2.6 POST `/v2/publish-retell-llm`
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Pubblica nuova versione agente
- **Use Case:** Versionamento agenti, A/B testing
- **Endpoint Proposto:** `POST /calls/retell/agents/{agent_id}/publish`

#### 2.7 GET `/v2/get-retell-llm-versions`
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa
- **Descrizione:** Lista versioni di un agente
- **Use Case:** Storia versioni, rollback
- **Endpoint Proposto:** `GET /calls/retell/agents/{agent_id}/versions`

#### 2.8 GET `/v2/get-mcp-tools`
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa
- **Descrizione:** Lista MCP tools disponibili per agenti
- **Use Case:** Integrazione con sistemi esterni
- **Endpoint Proposto:** `GET /calls/retell/agents/mcp-tools`

---

## 3️⃣ Conversation Flow Response Engine

### ❌ Completamente Mancante

#### 3.1 POST `/v2/create-conversation-flow`
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa (se si usa solo Retell LLM)
- **Descrizione:** Crea conversation flow agent (più avanzato di Retell LLM)
- **Use Case:** Conversazioni complesse, branching logic, tool calling avanzato
- **Endpoint Proposto:** `POST /calls/retell/conversation-flows`

#### 3.2 GET `/v2/get-conversation-flow`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `GET /calls/retell/conversation-flows/{flow_id}`

#### 3.3 GET `/v2/list-conversation-flows`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `GET /calls/retell/conversation-flows`

#### 3.4 PATCH `/v2/update-conversation-flow`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `PATCH /calls/retell/conversation-flows/{flow_id}`

#### 3.5 DELETE `/v2/delete-conversation-flow`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `DELETE /calls/retell/conversation-flows/{flow_id}`

---

## 4️⃣ Knowledge Base

### ❌ Completamente Mancante

**Nota:** Agoralia ha un sistema KB locale (`KnowledgeBase`, `KnowledgeSection`), ma non integra con Retell KB API.

#### 4.1 POST `/v2/create-knowledge-base`
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Crea KB su Retell (per RAG)
- **Use Case:** Sincronizzazione KB locale → Retell, RAG avanzato
- **Endpoint Proposto:** `POST /calls/retell/knowledge-bases`

#### 4.2 GET `/v2/get-knowledge-base`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `GET /calls/retell/knowledge-bases/{kb_id}`

#### 4.3 GET `/v2/list-knowledge-bases`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `GET /calls/retell/knowledge-bases`

#### 4.4 DELETE `/v2/delete-knowledge-base`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `DELETE /calls/retell/knowledge-bases/{kb_id}`

#### 4.5 POST `/v2/add-knowledge-base-sources`
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Aggiunge fonti (text, URL, file) a KB Retell
- **Use Case:** Sincronizzazione contenuti da Agoralia a Retell
- **Endpoint Proposto:** `POST /calls/retell/knowledge-bases/{kb_id}/sources`

#### 4.6 DELETE `/v2/delete-knowledge-base-source`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `DELETE /calls/retell/knowledge-bases/{kb_id}/sources/{source_id}`

**Integrazione Proposta:**
- Sincronizzare `KnowledgeBase` locale con Retell KB
- Usare Retell KB per RAG invece di passare KB in metadata
- Migliora performance e accuracy

---

## 5️⃣ Phone Number Management

### ✅ Implementato

#### 5.1 POST `/create-phone-number`
- **Status:** ✅ Implementato
- **Endpoint Agoralia:** `POST /calls/retell/phone-numbers/create`
- **File:** `backend/routes/calls.py:74`

#### 5.2 PATCH `/update-phone-number`
- **Status:** ✅ Implementato
- **Endpoint Agoralia:** `PATCH /calls/retell/phone-numbers/{phone_number}`
- **File:** `backend/routes/calls.py:608`

### ⚠️ Parziale

#### 5.3 GET `/get-phone-number`
- **Status:** ⚠️ Parziale (solo DB locale)
- **Endpoint Agoralia:** `GET /agents/numbers` (DB locale)
- **File:** `backend/routes/agents.py:157`
- **Manca:** Integrazione con Retell API per dettagli completi

#### 5.4 GET `/list-phone-numbers`
- **Status:** ⚠️ Parziale (solo DB locale)
- **Manca:** Sincronizzazione con Retell API

### ❌ Mancante

#### 5.5 DELETE `/delete-phone-number`
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Rilascia numero da Retell
- **Use Case:** Gestione ciclo vita numeri
- **Endpoint Proposto:** `DELETE /calls/retell/phone-numbers/{phone_number}`

#### 5.6 POST `/import-phone-number` (Custom Telephony)
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Importa numero da Twilio/Telnyx per Custom Telephony
- **Use Case:** Supporto chiamate internazionali, numeri esistenti
- **Endpoint Proposto:** `POST /calls/retell/phone-numbers/import`

---

## 6️⃣ Voice Management

### ❌ Completamente Mancante

#### 6.1 GET `/v2/get-voice`
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa
- **Descrizione:** Dettagli voce specifica
- **Use Case:** UI per selezione voci
- **Endpoint Proposto:** `GET /calls/retell/voices/{voice_id}`

#### 6.2 GET `/v2/list-voices`
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa
- **Descrizione:** Lista tutte le voci disponibili (ElevenLabs, etc.)
- **Use Case:** UI per selezione voci, filtri per lingua
- **Endpoint Proposto:** `GET /calls/retell/voices`

---

## 7️⃣ Batch Calls

### ❌ Mancante

#### 7.1 POST `/v2/create-batch-call`
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Crea batch di chiamate
- **Use Case:** Campagne massive, miglior efficienza API
- **Endpoint Proposto:** `POST /calls/retell/batch`
- **Nota:** Agoralia ha già `start_batch` in `misc.py`, ma usa loop sequenziale invece di Retell Batch API

---

## 8️⃣ Custom Telephony

### ❌ Mancante

#### 8.1 POST `/register-phone-call` (Custom Telephony)
- **Status:** ❌ Non implementato
- **Priorità:** 🟡 Media
- **Descrizione:** Registra chiamata per Custom Telephony (Twilio/Telnyx)
- **Use Case:** Supporto chiamate internazionali, numeri esistenti
- **Endpoint Proposto:** `POST /calls/retell/custom-telephony/register`

#### 8.2 Import Phone Number
- **Status:** ❌ Non implementato (vedi 5.6)

---

## 9️⃣ Chat & SMS

### ❌ Completamente Mancante

#### 9.1 POST `/v2/create-chat`
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa
- **Descrizione:** Crea chat session
- **Endpoint Proposto:** `POST /calls/retell/chat`

#### 9.2 GET `/v2/get-chat`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `GET /calls/retell/chat/{chat_id}`

#### 9.3 POST `/v2/create-chat-completion`
- **Status:** ❌ Non implementato
- **Endpoint Proposto:** `POST /calls/retell/chat/{chat_id}/completion`

#### 9.4 POST `/v2/create-outbound-sms`
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa
- **Descrizione:** Invia SMS via Retell
- **Endpoint Proposto:** `POST /calls/retell/sms`

---

## 🔟 Custom LLM WebSocket

### ❌ Mancante

#### 10.1 Custom LLM Integration
- **Status:** ❌ Non implementato
- **Priorità:** 🟢 Bassa
- **Descrizione:** Integrazione WebSocket per LLM custom
- **Use Case:** Usare LLM proprietario invece di Retell LLM
- **Implementazione:** Richiede WebSocket server-side

---

## 📋 Funzionalità Personalizzazione Mancanti (High Priority)

### 1. Agent Override Completo in `create-phone-call`

**Problema Attuale:**
- Solo `override_agent_id` e metadata KB supportati
- Manca supporto per `agent_override` completo

**Cosa Aggiungere:**
```python
agent_override = {
    "agent": {
        "voice_id": "...",
        "voice_model": "eleven_turbo_v2",
        "voice_temperature": 1.0,
        "language": "it-IT",
        "begin_message": "Ciao, sono l'assistente virtuale...",
    },
    "retell_llm": {
        "model": "gpt-4.1",
        "model_temperature": 0.7,
        "knowledge_base_ids": ["kb_001"],
        "dynamic_variables": {"customer_name": "Mario"},
    },
    "conversation_flow": {
        "model_choice": {"type": "cascading", "model": "gpt-5"},
        # ... altre opzioni
    }
}
```

**Priorità:** 🔴 Alta  
**Use Case:** Personalizzazione per chiamata, A/B testing, multi-lingua dinamico

---

### 2. Retell LLM Dynamic Variables

**Problema Attuale:**
- Non supportato in `create-phone-call`

**Cosa Aggiungere:**
```python
retell_llm_dynamic_variables = {
    "customer_name": "Mario Rossi",
    "product_name": "Prodotto X",
    "promotion_code": "PROMO2024",
}
```

**Priorità:** 🟡 Media  
**Use Case:** Personalizzazione prompt per cliente, campagne targetizzate

---

### 3. Knowledge Base Retell Integration

**Problema Attuale:**
- KB locale non sincronizzata con Retell
- KB passata in metadata invece di usare Retell KB API

**Cosa Aggiungere:**
- Endpoint per creare/aggiornare KB su Retell
- Sincronizzazione automatica KB locale → Retell
- Usare `knowledge_base_ids` invece di metadata KB

**Priorità:** 🟡 Media  
**Use Case:** RAG più efficiente, gestione centralizzata KB

---

### 4. Create/Update/Delete Agent (Retell LLM)

**Problema Attuale:**
- Solo GET agents implementato
- Non è possibile creare/modificare agenti da Agoralia

**Cosa Aggiungere:**
- `POST /calls/retell/agents` - Crea agente
- `PATCH /calls/retell/agents/{agent_id}` - Aggiorna agente
- `DELETE /calls/retell/agents/{agent_id}` - Elimina agente
- `POST /calls/retell/agents/{agent_id}/publish` - Pubblica versione

**Priorità:** 🔴 Alta  
**Use Case:** Gestione agenti dinamica, multi-lingua, personalizzazione completa

---

### 5. Voice Management

**Problema Attuale:**
- Liste voci hardcoded o non disponibili

**Cosa Aggiungere:**
- `GET /calls/retell/voices` - Lista voci disponibili
- `GET /calls/retell/voices/{voice_id}` - Dettagli voce

**Priorità:** 🟢 Bassa  
**Use Case:** UI per selezione voci, filtri per lingua

---

## 🚀 Piano di Implementazione Consigliato

### Fase 1: Personalizzazione Base (Alta Priorità)
1. ✅ **Agent Override Completo** - Aggiungere supporto `agent_override` completo in `create-phone-call`
2. ✅ **Dynamic Variables** - Aggiungere `retell_llm_dynamic_variables`
3. ✅ **Create/Update/Delete Agent** - CRUD completo per Retell LLM agents

**Tempo Stimato:** 2-3 giorni  
**Impatto:** Massima personalizzazione per chiamata e gestione agenti

---

### Fase 2: Integrazione Knowledge Base (Media Priorità)
1. ✅ **Retell KB CRUD** - Creare/aggiornare KB su Retell
2. ✅ **Sincronizzazione KB** - Sync KB locale → Retell
3. ✅ **Usare KB IDs** - Passare `knowledge_base_ids` invece di metadata KB

**Tempo Stimato:** 2-3 giorni  
**Impatto:** RAG più efficiente, gestione KB centralizzata

---

### Fase 3: Funzionalità Avanzate (Media/Bassa Priorità)
1. ✅ **Phone Number Import** - Custom Telephony per chiamate internazionali
2. ✅ **Batch Calls API** - Usare Retell Batch API invece di loop sequenziale
3. ✅ **Voice Management** - Lista voci per UI
4. ✅ **Update/Delete Call** - Gestione chiamate in corso

**Tempo Stimato:** 3-4 giorni  
**Impatto:** Funzionalità enterprise, supporto internazionale

---

### Fase 4: Funzionalità Future (Bassa Priorità)
1. ✅ **Conversation Flow** - Se necessario per casi d'uso avanzati
2. ✅ **Chat/SMS** - Se si espande oltre voice
3. ✅ **Custom LLM WebSocket** - Se si vuole LLM proprietario

**Tempo Stimato:** 5-7 giorni  
**Impatto:** Espansione piattaforma

---

## 📝 Note Finali

1. **Priorità Fase 1** è critica per garantire massima personalizzazione
2. **Fase 2** migliora significativamente efficienza RAG
3. **Fase 3** abilita funzionalità enterprise (internazionali, batch)
4. **Fase 4** è opzionale in base a roadmap prodotto

**Riferimenti:**
- [Retell AI API Docs](https://docs.retellai.com/api-references/)
- [Create Phone Call](https://docs.retellai.com/api-references/create-phone-call)
- [Agent Override](https://docs.retellai.com/api-references/create-phone-call#agent-override)

