# RetellAI Agent Customization Guide

Questa guida descrive tutte le informazioni che puoi inviare a RetellAI per personalizzare completamente i tuoi agenti vocali.

## Endpoint Principale

**POST `/calls/retell/agents/create`**

Questo endpoint supporta tutti i campi di personalizzazione disponibili in RetellAI.

## 1. Response Engine (Obbligatorio)

Il `response_engine` definisce come l'agente genera le risposte. Puoi usare:

### Retell LLM (Consigliato)
```json
{
  "response_engine": {
    "type": "retell-llm",
    "model": "gpt-4o-mini",  // o "gpt-4o", "gpt-4.1", "claude-4.5-sonnet", etc.
    "begin_message": "Ciao, sono l'assistente virtuale. Come posso aiutarti?",
    "start_speaker": "agent",  // o "user"
    "knowledge_base_ids": ["knowledge_base_xxx"],  // Opzionale: KB IDs da RetellAI
    "model_temperature": 0.7,  // 0-2, default 0.7
    "s2s_model": "gpt-4o-mini"  // Speech-to-speech model
  }
}
```

**Nota**: Se non specifichi `llm_id`, il sistema crea automaticamente un Retell LLM per te.

### Conversation Flow
```json
{
  "response_engine": {
    "type": "conversation-flow",
    "conversation_flow_id": "flow_xxx"
  }
}
```

## 2. Configurazione Voce

### Campi Base
- **`voice_id`** (obbligatorio): ID della voce (es. `"11labs-Adrian"`, `"openai-Alloy"`)
- **`voice_model`**: Modello vocale (solo per ElevenLabs)
  - `"eleven_turbo_v2"`, `"eleven_flash_v2"`, `"eleven_turbo_v2_5"`, `"eleven_flash_v2_5"`, `"eleven_multilingual_v2"`
  - `"tts-1"`, `"gpt-4o-mini-tts"` (per OpenAI)

### Personalizzazione Voce
- **`voice_temperature`** (0-2): Stabilità della voce
  - `0` = molto stabile, sempre uguale
  - `2` = molto variabile, più naturale
  - Default: `1`

- **`voice_speed`** (0.5-2): Velocità di parola
  - `0.5` = molto lento
  - `2` = molto veloce
  - Default: `1`

- **`volume`** (0-2): Volume della voce
  - `0` = silenzioso
  - `2` = molto alto
  - Default: `1`

- **`fallback_voice_ids`**: Array di voci di riserva se la voce principale ha problemi
  ```json
  "fallback_voice_ids": ["openai-Alloy", "deepgram-Angus"]
  ```
  **Importante**: Le voci di fallback devono essere di provider diversi dalla voce principale.

## 3. Comportamento Agente

### Responsività e Interruzioni
- **`responsiveness`** (0-1): Quanto è reattivo l'agente
  - `0` = aspetta di più, risponde più lentamente
  - `1` = risponde immediatamente quando può
  - Default: `1`

- **`interruption_sensitivity`** (0-1): Sensibilità alle interruzioni
  - `0` = difficile interrompere, l'agente continua a parlare
  - `1` = facile interrompere
  - Default: `1`
  - **Nota**: Se `0`, l'agente non può essere mai interrotto

### Backchannel (Interiezioni)
- **`enable_backchannel`**: Abilita interiezioni tipo "sì", "uh-huh"
  - Default: `false`

- **`backchannel_frequency`** (0-1): Frequenza delle interiezioni
  - `0` = meno frequenti
  - `1` = più frequenti
  - Default: `0.8` (se backchannel abilitato)

- **`backchannel_words`**: Lista personalizzata di parole per backchannel
  ```json
  "backchannel_words": ["sì", "ok", "capito", "perfetto"]
  ```

### Promemoria
- **`reminder_trigger_ms`**: Dopo quanti millisecondi di silenzio l'agente ricorda all'utente
  - Default: `10000` (10 secondi)
  - Minimo: `1`

- **`reminder_max_count`**: Quante volte l'agente può ricordare
  - Default: `1`
  - `0` = disabilitato

## 4. Suoni Ambientali

- **`ambient_sound`**: Suono di sottofondo
  - `"coffee-shop"` - Caffetteria con persone che chiacchierano
  - `"convention-hall"` - Sala convention con eco
  - `"summer-outdoor"` - Esterno estivo con cicale
  - `"mountain-outdoor"` - Montagna con uccelli
  - `"static-noise"` - Rumore statico costante
  - `"call-center"` - Rumore call center
  - `null` = nessun suono

- **`ambient_sound_volume`** (0-2): Volume del suono ambientale
  - Default: `1`

## 5. Lingua e Webhook

- **`language`**: Codice lingua per riconoscimento vocale
  - `"en-US"`, `"en-GB"`, `"en-AU"`, `"it-IT"`, `"es-ES"`, `"fr-FR"`, `"de-DE"`, etc.
  - `"multi"` = multilingue (spagnolo e inglese)
  - Default: `"en-US"`

- **`webhook_url`**: URL per ricevere eventi della chiamata
  - Se impostato, sovrascrive il webhook a livello account
  - `null` = usa webhook account

- **`webhook_timeout_ms`**: Timeout webhook in millisecondi
  - Default: `10000` (10 secondi)

## 6. Trascrizione e Parole Chiave

- **`boosted_keywords`**: Parole chiave da favorire nella trascrizione
  ```json
  "boosted_keywords": ["Agoralia", "RetellAI", "Mario Rossi"]
  ```
  Utile per nomi propri, brand, termini tecnici.

- **`stt_mode`**: Modalità speech-to-text
  - `"fast"` = priorità alla velocità (default)
  - `"accurate"` = priorità all'accuratezza

- **`vocab_specialization`**: Specializzazione vocabolario (solo inglese)
  - `"general"` = vocabolario generale (default)
  - `"medical"` = vocabolario medico

- **`denoising_mode`**: Modalità di rimozione rumore
  - `"noise-cancellation"` = rimuove solo rumore (default)
  - `"noise-and-background-speech-cancellation"` = rimuove anche voci di sottofondo

## 7. Storage Dati

- **`data_storage_setting`**: Cosa memorizzare
  - `"everything"` = tutto (transcript, recording, logs) - default
  - `"everything_except_pii"` = tutto tranne PII quando rilevato
  - `"basic_attributes_only"` = solo attributi base, niente transcript/recording/logs

- **`opt_in_signed_url`**: Abilita URL firmati per log e recording
  - `true` = URL con firma che scadono dopo 24h
  - Default: `false`

## 8. Pronuncia e Normalizzazione

- **`pronunciation_dictionary`**: Dizionario personalizzato per pronuncia
  ```json
  "pronunciation_dictionary": [
    {
      "word": "Agoralia",
      "alphabet": "ipa",
      "phoneme": "aɡoˈralia"
    }
  ]
  ```
  **Nota**: Solo per inglese e voci 11labs.

- **`normalize_for_speech`**: Normalizza numeri, valute, date in forma parlata
  - `true` = converte "€24.50" in "ventiquattro euro e cinquanta centesimi"
  - Default: `false`

## 9. Impostazioni Chiamata

- **`end_call_after_silence_ms`**: Termina chiamata dopo silenzio (ms)
  - Default: `600000` (10 minuti)
  - Minimo: `10000` (10 secondi)

- **`max_call_duration_ms`**: Durata massima chiamata (ms)
  - Default: `3600000` (1 ora)
  - Minimo: `60000` (1 minuto)
  - Massimo: `7200000` (2 ore)

- **`begin_message_delay_ms`**: Ritardo prima del primo messaggio (ms)
  - Range: `0-5000`
  - Default: `0` (immediato)
  - Utile per dare tempo all'utente di prepararsi

- **`ring_duration_ms`**: Durata suoneria (ms)
  - Default: `30000` (30 secondi)
  - Range: `5000-90000`

## 10. Voicemail

- **`voicemail_option`**: Configurazione rilevamento voicemail
  ```json
  "voicemail_option": {
    "action": {
      "type": "static_text",
      "text": "Per favore richiamaci domani alle 10:00"
    }
  }
  ```
  Rileva voicemail nei primi 3 minuti e applica l'azione.

## 11. Analisi Post-Chiamata

- **`post_call_analysis_data`**: Dati da estrarre dopo la chiamata
  ```json
  "post_call_analysis_data": [
    {
      "type": "string",
      "name": "customer_name",
      "description": "Nome del cliente",
      "examples": ["Mario Rossi", "Giulia Bianchi"]
    },
    {
      "type": "number",
      "name": "interest_level",
      "description": "Livello di interesse (1-10)"
    }
  ]
  ```

- **`post_call_analysis_model`**: Modello per analisi
  - `"gpt-4o-mini"` (default), `"gpt-4o"`, `"gpt-4.1"`, `"claude-4.5-sonnet"`, etc.

## 12. DTMF (Tastierino Telefonico)

- **`allow_user_dtmf`**: Permetti input DTMF
  - Default: `true`

- **`user_dtmf_options`**: Opzioni DTMF
  ```json
  "user_dtmf_options": {
    "digit_limit": 25,
    "termination_key": "#",
    "timeout_ms": 8000
  }
  ```

## 13. PII (Personally Identifiable Information)

- **`pii_config`**: Configurazione rimozione PII
  ```json
  "pii_config": {
    "mode": "post_call",  // o "real_time"
    "categories": ["email", "phone_number", "ssn"]
  }
  ```

## 14. Knowledge Base

L'agente può essere collegato a una o più knowledge base RetellAI:

```json
{
  "response_engine": {
    "type": "retell-llm",
    "llm_id": "llm_xxx",
    "knowledge_base_ids": [
      "knowledge_base_abc123",
      "knowledge_base_def456"
    ],
    "kb_config": {
      "mode": "retrieval",  // o "generation"
      "top_k": 3
    }
  }
}
```

**Nota**: Se `connect_to_general_kb: true`, la KB generale dell'account viene aggiunta automaticamente.

## Esempio Completo

```json
{
  "response_engine": {
    "type": "retell-llm",
    "model": "gpt-4o-mini",
    "begin_message": "Ciao, sono l'assistente di Agoralia. Come posso aiutarti?",
    "start_speaker": "agent"
  },
  "agent_name": "Assistente Vendite",
  "voice_id": "11labs-Adrian",
  "voice_model": "eleven_turbo_v2",
  "voice_temperature": 1.2,
  "voice_speed": 1.1,
  "volume": 1.0,
  "language": "it-IT",
  "responsiveness": 0.9,
  "interruption_sensitivity": 0.8,
  "enable_backchannel": true,
  "backchannel_frequency": 0.7,
  "backchannel_words": ["sì", "ok", "perfetto"],
  "boosted_keywords": ["Agoralia", "RetellAI"],
  "stt_mode": "fast",
  "vocab_specialization": "general",
  "webhook_url": "https://app.agoralia.app/api/webhooks/retell",
  "webhook_timeout_ms": 10000,
  "end_call_after_silence_ms": 600000,
  "max_call_duration_ms": 3600000,
  "data_storage_setting": "everything",
  "normalize_for_speech": true,
  "connect_to_general_kb": true,
  "save_to_agoralia": true
}
```

## Endpoint per Aggiornamento

**PATCH `/calls/retell/agents/{agent_id}`**

Puoi aggiornare un agente esistente con gli stessi campi (tranne `response_engine` che richiede un aggiornamento separato del Retell LLM).

## Endpoint per Test Call

**POST `/calls/retell/agents/{agent_id}/test-call`**

```json
{
  "to_number": "+393491234567",
  "from_number": "+393401234567"  // Opzionale
}
```

## Note Importanti

1. **Response Engine**: Se non specifichi `llm_id` nel `response_engine`, il sistema crea automaticamente un Retell LLM per te.

2. **Knowledge Base**: La KB generale viene collegata automaticamente se `connect_to_general_kb: true`.

3. **Voice Model**: Alcuni modelli vocali funzionano solo con certe lingue. Per `it-IT`, non usare `eleven_turbo_v2` (non supportato).

4. **Fallback Voices**: Devono essere di provider diversi dalla voce principale.

5. **Webhook**: Se specifichi un webhook per l'agente, sovrascrive il webhook a livello account.

6. **PII**: La rimozione PII può essere in tempo reale o post-chiamata.

