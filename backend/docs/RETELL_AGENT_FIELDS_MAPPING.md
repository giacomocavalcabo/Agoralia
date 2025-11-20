# Mappatura Completa Campi RetellAI Agent

Questo documento mappa tutti i campi disponibili nell'API RetellAI per creare agenti, confrontandoli con ciò che è supportato in Agoralia.

## ✅ Campi Supportati in Agoralia

### Welcome Message & Speaking Settings

| Campo UI RetellAI | Campo API RetellAI | Supportato | Nota |
|-------------------|-------------------|------------|------|
| **Welcome Message** | `response_engine.begin_message` | ✅ | Passato quando si crea il Retell LLM |
| **Custom message** | `response_engine.begin_message` | ✅ | Stesso campo di Welcome Message |
| **AI speaks first** | `response_engine.start_speaker` = `"agent"` | ✅ | Passato quando si crea il Retell LLM |
| **Pause Before Speaking** | `begin_message_delay_ms` | ✅ | Campo a livello agente (0-5000 ms) |

**Come passarlo:**
```json
{
  "response_engine": {
    "type": "retell-llm",
    "begin_message": "Ciao, sono l'assistente virtuale...",
    "start_speaker": "agent"  // "agent" per AI speaks first, "user" per aspetta utente
  },
  "begin_message_delay_ms": 1000  // Pausa prima di parlare (in ms)
}
```

### Functions / Tools

| Campo UI RetellAI | Campo API RetellAI | Supportato | Nota |
|-------------------|-------------------|------------|------|
| **Functions** | `response_engine.tools` | ⚠️ | Configurato nel Retell LLM, non ancora esposto nel form |

**Note:** Le funzioni vanno configurate nel Retell LLM tramite `tools` array. Questo richiede configurazione manuale nel `response_engine`.

### Knowledge Base

| Campo UI RetellAI | Campo API RetellAI | Supportato | Nota |
|-------------------|-------------------|------------|------|
| **Knowledge Base** | `response_engine.knowledge_base_ids` | ✅ | Array di ID KB RetellAI |
| **KB Retrieval Chunks** | `response_engine.kb_config.top_k` | ⚠️ | Non ancora esposto nel form |
| **KB Similarity** | `response_engine.kb_config.mode` | ⚠️ | Non ancora esposto nel form |

**Come passarlo:**
```json
{
  "response_engine": {
    "type": "retell-llm",
    "knowledge_base_ids": ["knowledge_base_xxx"],
    "kb_config": {
      "mode": "retrieval",  // o "generation"
      "top_k": 3  // Numero di chunks da recuperare
    }
  }
}
```

### Speech Settings

| Campo UI RetellAI | Campo API RetellAI | Supportato | Tipo |
|-------------------|-------------------|------------|------|
| **Background Sound** | `ambient_sound` | ✅ | `coffee-shop`, `convention-hall`, `summer-outdoor`, `mountain-outdoor`, `static-noise`, `call-center`, `null` |
| **Responsiveness** | `responsiveness` | ✅ | `0-1` (1 = più veloce) |
| **Interruption Sensitivity** | `interruption_sensitivity` | ✅ | `0-1` (1 = più facile interrompere) |
| **Enable Backchanneling** | `enable_backchannel` | ✅ | `boolean` |
| **Backchannel Frequency** | `backchannel_frequency` | ✅ | `0-1` |
| **Backchannel Words** | `backchannel_words` | ✅ | `string[]` |
| **Enable Speech Normalization** | `normalize_for_speech` | ✅ | `boolean` |
| **Reminder Message Frequency** | `reminder_trigger_ms` | ✅ | `number` (ms) |
| **Reminder Max Count** | `reminder_max_count` | ✅ | `integer` |
| **Pronunciation** | `pronunciation_dictionary` | ✅ | `array<{word, alphabet, phoneme}>` |

**Come passarlo:**
```json
{
  "ambient_sound": "coffee-shop",
  "ambient_sound_volume": 1,
  "responsiveness": 0.9,
  "interruption_sensitivity": 0.8,
  "enable_backchannel": true,
  "backchannel_frequency": 0.7,
  "backchannel_words": ["sì", "ok", "perfetto"],
  "normalize_for_speech": true,
  "reminder_trigger_ms": 10000,
  "reminder_max_count": 2,
  "pronunciation_dictionary": [
    {
      "word": "Agoralia",
      "alphabet": "ipa",
      "phoneme": "aɡoˈralia"
    }
  ]
}
```

### Realtime Transcription Settings

| Campo UI RetellAI | Campo API RetellAI | Supportato | Tipo |
|-------------------|-------------------|------------|------|
| **Denoising Mode** | `denoising_mode` | ✅ | `"noise-cancellation"` o `"noise-and-background-speech-cancellation"` |
| **Transcription Mode** | `stt_mode` | ✅ | `"fast"` o `"accurate"` |
| **Boosted Keywords** | `boosted_keywords` | ✅ | `string[]` |

**Come passarlo:**
```json
{
  "denoising_mode": "noise-cancellation",
  "stt_mode": "fast",
  "boosted_keywords": ["Agoralia", "RetellAI", "Mario Rossi"]
}
```

### Call Settings

| Campo UI RetellAI | Campo API RetellAI | Supportato | Tipo |
|-------------------|-------------------|------------|------|
| **Voicemail Detection** | `voicemail_option` | ✅ | `{action: {type, text}}` o `null` |
| **User Keypad Input Detection** | `allow_user_dtmf` | ✅ | `boolean` |
| **DTMF Timeout** | `user_dtmf_options.timeout_ms` | ✅ | `number` (ms) |
| **Termination Key** | `user_dtmf_options.termination_key` | ✅ | `string` (es. `"#"`) |
| **Digit Limit** | `user_dtmf_options.digit_limit` | ✅ | `number` |
| **End Call on Silence** | `end_call_after_silence_ms` | ✅ | `number` (ms, min 10000) |
| **Max Call Duration** | `max_call_duration_ms` | ✅ | `number` (ms, 60000-7200000) |
| **Ring Duration** | `ring_duration_ms` | ✅ | `number` (ms, 5000-90000) |

**Come passarlo:**
```json
{
  "voicemail_option": {
    "action": {
      "type": "static_text",
      "text": "Please give us a callback tomorrow at 10am."
    }
  },
  "allow_user_dtmf": true,
  "user_dtmf_options": {
    "digit_limit": 25,
    "termination_key": "#",
    "timeout_ms": 8000
  },
  "end_call_after_silence_ms": 600000,
  "max_call_duration_ms": 3600000,
  "ring_duration_ms": 30000
}
```

### Post-Call Data Extraction

| Campo UI RetellAI | Campo API RetellAI | Supportato | Tipo |
|-------------------|-------------------|------------|------|
| **Post Call Data Retrieval** | `post_call_analysis_data` | ✅ | `array<{type, name, description, examples}>` |
| **Post Call Analysis Model** | `post_call_analysis_model` | ✅ | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, etc. |

**Come passarlo:**
```json
{
  "post_call_analysis_data": [
    {
      "type": "string",
      "name": "customer_name",
      "description": "The name of the customer.",
      "examples": ["John Doe", "Jane Smith"]
    },
    {
      "type": "boolean",
      "name": "call_successful",
      "description": "Whether the call was successful."
    }
  ],
  "post_call_analysis_model": "gpt-4o-mini"
}
```

### Security & Fallback Settings

| Campo UI RetellAI | Campo API RetellAI | Supportato | Tipo |
|-------------------|-------------------|------------|------|
| **Data Storage Settings** | `data_storage_setting` | ✅ | `"everything"`, `"everything_except_pii"`, `"basic_attributes_only"` |
| **Personal Info Redaction (PII)** | `pii_config` | ✅ | `{mode, categories}` |
| **Opt In Secure URLs** | `opt_in_signed_url` | ✅ | `boolean` |
| **Fallback Voice ID** | `fallback_voice_ids` | ✅ | `string[]` |
| **Default Dynamic Variables** | Non a livello agente | ❌ | Configurato a livello account o per chiamata |

**Come passarlo:**
```json
{
  "data_storage_setting": "everything",
  "opt_in_signed_url": true,
  "pii_config": {
    "mode": "post_call",  // o "real_time"
    "categories": ["email", "phone_number", "ssn"]
  },
  "fallback_voice_ids": ["openai-Alloy", "deepgram-Angus"]
}
```

### Webhook Settings

| Campo UI RetellAI | Campo API RetellAI | Supportato | Tipo |
|-------------------|-------------------|------------|------|
| **Agent Level Webhook URL** | `webhook_url` | ✅ | `string` (URL) |
| **Webhook Timeout** | `webhook_timeout_ms` | ✅ | `number` (ms, 1000-30000) |

**Come passarlo:**
```json
{
  "webhook_url": "https://app.agoralia.app/api/webhooks/retell",
  "webhook_timeout_ms": 10000
}
```

### MCPs (Model Context Protocol)

| Campo UI RetellAI | Campo API RetellAI | Supportato | Nota |
|-------------------|-------------------|------------|------|
| **MCPs** | Non documentato in API | ❓ | Potrebbe essere una funzionalità separata o in beta |

## 📋 Riepilogo

### ✅ Completamente Supportati
- Welcome Message / Custom Message / AI speaks first / Pause Before Speaking
- Knowledge Base (base)
- Tutti i Speech Settings
- Tutte le Realtime Transcription Settings
- Tutte le Call Settings
- Post-Call Data Extraction
- Security & Fallback Settings (tranne Dynamic Variables)
- Webhook Settings

### ⚠️ Parzialmente Supportati
- **Knowledge Base KB Config**: Supportato a livello API ma non esposto nel form frontend
- **Functions/Tools**: Supportato a livello API ma richiede configurazione manuale nel `response_engine`

### ❓ Da Verificare
- **MCPs**: Non chiaro dalla documentazione API se sia supportato via API

### ❌ Non Supportati a Livello Agente
- **Default Dynamic Variables**: Configurati a livello account o per singola chiamata, non per agente

## 🔧 Come Aggiungere Campi Mancanti

Per aggiungere supporto a campi non ancora esposti nel form:

1. **KB Config (top_k, mode)**:
   - Aggiungere campi opzionali in `AgentCreateRequest`
   - Passarli al `response_engine.kb_config` quando si crea l'agente

2. **Functions/Tools**:
   - Aggiungere campo `tools` in `AgentCreateRequest`
   - Passarlo al `response_engine` quando si crea il Retell LLM

3. **MCPs**:
   - Verificare documentazione RetellAI per endpoint specifico
   - Potrebbe richiedere configurazione separata post-creazione

