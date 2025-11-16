# Struttura UI - Percorso Utente per Campagne

## Flusso Logico

1. **Setup Iniziale** → Configura i "mattoni"
2. **Crea Campagna** → Usa i mattoni configurati
3. **Monitora** → Vedi risultati in tempo reale

---

## Struttura Pagine (Approccio Moderno)

### **1. Dashboard** (`/`)
**Scopo**: Overview generale e entry point
- KPIs essenziali (chiamate attive, costo)
- Chiamate live
- Link veloce a "Crea Campagna" (se setup completo)

**Cosa mostra**:
- ✅ Setup completo → "Crea Campagna" prominente + badge "Sistema pronto per chiamare ✅"
- ⚠️ Setup incompleto → **Checklist mini** con indicatori visivi:

```
┌─────────────────────────────────────────┐
│ Per lanciare la prima campagna:         │
│                                          │
│ ✅ Numero telefonico                     │
│ ✅ Agent                                 │
│ ⚠️  Knowledge Base  [Completa ora →]   │
│ ⚠️  Leads         [Importa ora →]       │
│                                          │
│ Progress: 2/4 completati                 │
└─────────────────────────────────────────┘
```

**Pattern UX**:
- Ogni item della checklist ha un pulsante "Completa ora" che porta allo step specifico
- Badge visivo sempre visibile: "Sistema pronto ✅" / "Setup incompleto ⚠️"
- Quick stats: "X agenti configurati", "Y leads pronti", "Z KB attive"

---

### **2. Setup/Wizard** (`/setup` o `/onboarding`)
**Scopo**: Guida step-by-step per configurare i 4 mattoni

**⚠️ IMPORTANTE: Ordine fisso e coerente dei mattoni**
Per coerenza mentale, **sempre** nello stesso ordine e con stesse icone:
1. 📞 **Numero Telefonico**
2. 📚 **Knowledge Base**
3. 🤖 **Agent**
4. 👥 **Leads**

**Flusso**:
```
Step 1: Numero Telefonico → `/setup/phone`
  - Aggiungi/modifica numeri
  - Verifica numeri
  - Call-to-action: "Configura numero"
  - Educazione: "Per chiamare i tuoi clienti serve almeno un numero attivo"
  - ✅ "Numero configurato" → prossimo step

Step 2: Knowledge Base → `/setup/knowledge`
  - Crea/modifica KB
  - Upload documenti
  - Call-to-action: "Crea Knowledge Base"
  - Educazione: "La KB fornisce informazioni al tuo agent durante le chiamate"
  - ✅ "KB pronta" → prossimo step

Step 3: Bot/Agent → `/setup/agent`
  - Crea/modifica agent
  - Configura voice, language, instructions
  - Call-to-action: "Crea Agent"
  - Educazione: "L'agent è la voce AI che farà le chiamate per te"
  - ✅ "Agent configurato" → prossimo step

Step 4: Leads → `/setup/leads`
  - Import CSV
  - Gestisci liste contatti
  - Call-to-action: "Importa Leads"
  - Educazione: "I leads sono i contatti che riceveranno le chiamate"
  - ✅ "Leads pronti" → setup completo
```

**UI Pattern**: 
- Progress bar in alto (1/4, 2/4, 3/4, 4/4)
- Next/Previous buttons
- Skip opzionale per step già completati (con badge "Completato")
- Salva automaticamente
- **Educazione breve**: ogni step ha 1 frase che spiega perché serve quel mattone

**Comportamento dopo setup completo**:
- Una volta completato il setup, il wizard `/setup` diventa meno centrale
- Accessibile via "Impostazioni > Setup" o link secondario
- Il percorso principale passa a: **Dashboard → Crea Campagna**

---

### **3. Gestione Mattoni** (Accesso diretto dalle pagine dedicate)

#### **3a. Numeri Telefonici** (`/numbers`)
**Scopo**: Gestisci tutti i numeri telefonici
- Lista numeri (stato: pending/active/suspended)
- Aggiungi nuovo numero
- Verifica numeri
- Impostazioni (timezone, quiet hours)

#### **3b. Knowledge Bases** (`/knowledge`)
**Scopo**: Gestisci le knowledge bases
- Lista KB (nome, documenti, stato)
- Crea nuova KB
- Upload documenti (PDF, TXT, etc.)
- Sync status con Retell

#### **3c. Agents** (`/agents`)
**Scopo**: Gestisci gli agenti vocali
- Lista agenti (nome, language, voice)
- Crea nuovo agent
- Configurazione dettagliata (instructions, voice, language)
- Test agent (preview)

#### **3d. Leads** (`/leads`)
**Scopo**: Gestisci i contatti/leads
- Lista leads (filtri, search)
- Import CSV
- Aggiungi manualmente
- Assegna a campagne
- DNC (Do Not Call) list

---

### **4. Campagne** (`/campaigns`)
**Scopo**: Crea e gestisci campagne

**Vista Lista**:
- Lista campagne (stato: draft/running/paused/completed)
- Filtri (stato, data)
- "Crea Campagna" button

**Vista Dettaglio** (`/campaigns/:id`):
- **Banner stato pronto/non pronto** (sempre visibile):
  - ✅ "Campagna pronta per partire"
  - ⚠️ "Campagna non può partire: mancano leads / numero / fuori orario"

- **Tab: Configurazione**
  - Nome, date, timezone
  - **Selezione mattoni con badge visivi** (ordine fisso: Numero → KB → Agent → Leads):
    - ✅ "Numero: +1415... (US, 09:00–18:00)"
    - ✅ "Agent: Sales IT (IT, Voce X)"
    - ⚠️ "Knowledge Base: Non selezionata [Seleziona →]"
    - ⚠️ "Leads: 0 leads assegnati [Aggiungi leads →]"
  - Budget, limiti, quiet hours

- **Tab: Leads**
  - Lista leads assegnati
  - Filtri, esclusioni

- **Tab: Risultati**
  - Statistiche (chiamate fatte, successo, costo)
  - Grafici temporali
  - Lista chiamate

**Vista Creazione** (`/campaigns/new`):
- Form guidato a step (come wizard)
- Step 1: Nome + Date
- Step 2: Seleziona mattoni (phone, agent, KB, leads) - **ordine fisso**
- Step 3: Impostazioni (budget, limiti, quiet hours)
- Step 4: Review & Launch

**⚠️ Pattern critico: Creazione inline dei mattoni**
Nel wizard di creazione campagna, **se manca un mattone** (es. nessun Agent creato):
- ❌ **NON bloccare** l'utente con errore
- ✅ Mostrare inline:
  ```
  ┌─────────────────────────────────────┐
  │ Nessun agent disponibile            │
  │ [Crea un agent adesso] (modal)      │
  └─────────────────────────────────────┘
  ```
- Permettere creazione on-the-fly via **modal o side panel**
- Dopo creazione: auto-refresh dropdown, seleziona il nuovo item
- **Flusso fluido**: non uscire dal wizard per completare un mattone mancante

---

### **5. Chiamate** (`/calls`)
**Scopo**: Storico e dettagli chiamate
- Lista tutte le chiamate (filtri, search)
- Dettaglio singola chiamata (transcript, audio, metrics)
- **Filtri sempre visibili** (sidebar o barra superiore):
  - Filtro per **Campaign** (dropdown)
  - Filtro per **Agent** (dropdown)
  - Filtro per **Outcome** (esito: success, no-answer, DNC, qualified, not-interested, ecc.)
  - Filtro per **Data** (date range picker)
  - Filtro per **Durata** (min/max)
- Search bar (full-text search su numeri, transcript, metadata)

**Pattern UX**:
- Le persone vogliono filtrare rapidamente:
  - "Fammi vedere solo le chiamate fallite"
  - "Fammi vedere solo quelle di questa campagna"
  - "Fammi vedere solo le chiamate qualificate"
- Nel **dettaglio chiamata**:
  - **Outcome molto in alto**: "Call outcome: Qualified lead / Not interested / No answer"
  - Transcript con highlighting parole chiave
  - Audio player prominente
  - Metrics (durata, sentiment, punti salienti)

---

### **6. Analytics** (`/analytics`) - Opzionale
**Scopo**: Metriche aggregate
- Grafici temporali
- Confronto campagne
- ROI, conversioni

---

## Pattern UI/UX Raccomandati

### **Onboarding First-Time**
Quando utente nuovo → redirect a `/setup`
- Checklist: "Per creare la tua prima campagna, completa:"
  - [ ] Numero telefonico
  - [ ] Knowledge Base
  - [ ] Agent
  - [ ] Leads
- Progress: 0/4 → 4/4
- Button "Inizia Setup" → wizard

### **Quick Actions**
Dashboard sempre mostra:
- "Crea Campagna" (se setup completo)
- "Completa Setup" (se setup incompleto)
- Link rapidi ai mattoni più usati

### **Breadcrumbs & Navigation**
```
Dashboard > Campagne > [Nome Campagna]
Dashboard > Setup > Step 2: Knowledge Base
Dashboard > Agents > [Nome Agent]
```

### **Empty States**
Ogni pagina mostra cosa fare se vuota:
- `/campaigns` (vuota) → "Nessuna campagna. Crea la tua prima campagna!"
- `/leads` (vuota) → "Nessun lead. Importa un CSV o aggiungi manualmente."

### **Validation & Feedback**
- Prima di salvare campagna: check che tutti i mattoni esistano
- Se manca qualcosa: **creazione inline** (modal/side panel), non link esterno
- Toast messages: "Campagna creata!" "Agent configurato!"
- Feedback visivo: badge di stato, indicatori di completamento

### **Multi-Tenant / Workspace Selector**
Se l'utente può avere **più workspace/tenant**:
- **Selettore sempre visibile** in alto a destra:
  ```
  ┌─────────────────────────────┐
  │ Workspace: ACME Srl ▾       │
  │ [Logo/Iniziali]             │
  └─────────────────────────────┘
  ```
- Nome workspace e logo/iniziali per riconoscimento visivo
- Tutte le pagine filtrano automaticamente su quel workspace
- **Molto visibile**: non nascondere questo selettore, è cruciale per evitare confusione ("sto guardando le campagne di chi?")

---

## Struttura File Frontend (Organizzata)

```
frontend/src/
├── pages/
│   ├── Dashboard.jsx          # Overview
│   ├── Setup/
│   │   ├── SetupWizard.jsx    # Container wizard
│   │   ├── PhoneStep.jsx      # Step 1
│   │   ├── KnowledgeStep.jsx  # Step 2
│   │   ├── AgentStep.jsx      # Step 3
│   │   └── LeadsStep.jsx      # Step 4
│   ├── Numbers.jsx            # Gestione numeri
│   ├── KnowledgeBases.jsx     # Gestione KB
│   ├── Agents.jsx             # Gestione agenti
│   ├── Leads.jsx              # Gestione leads
│   ├── Campaigns/
│   │   ├── CampaignsList.jsx  # Lista campagne
│   │   ├── CampaignNew.jsx    # Crea campagna (wizard)
│   │   └── CampaignDetail.jsx # Dettaglio campagna
│   ├── Calls.jsx              # Storico chiamate
│   └── Analytics.jsx          # Metriche aggregate
```

---

## Proposta Alternativa: Single-Page Approach (Più Moderna)

Se vuoi un approccio più fluido, potresti usare:

### **Workspace View** (`/workspace`)
Una sola pagina con tab laterali:
- **Setup** (sidebar con 4 sezioni: Phone, KB, Agent, Leads)
- **Campagne** (lista + crea)
- **Calls** (storico)

Con modals/panels per creare/modificare invece di navigare.

---

## Raccomandazione Finale

**Approccio Ibrido** (consigliato):
1. **Onboarding Wizard** per primi utenti (`/setup`)
2. **Pagine Dedicati** per gestione completa (`/numbers`, `/knowledge`, `/agents`, `/leads`)
3. **Campagne** con wizard di creazione (`/campaigns/new`)
4. **Dashboard** come hub centrale

**Totale Pagine**: ~8-10 pagine principali
- Dashboard (1)
- Setup Wizard (1, con 4 step interni)
- Gestione Mattoni (4: numbers, knowledge, agents, leads)
- Campagne (2: lista + dettaglio/creazione)
- Calls (1)
- Analytics (1, opzionale)

---

## Implementazione Priorità

**Fase 1**: Setup base
- Dashboard
- Setup Wizard (4 step)
- Pagina Campagne (lista + crea base)

**Fase 2**: Gestione completa
- Pagine dedicati per ogni mattone
- Campagna dettaglio con tab

**Fase 3**: Polish
- Analytics
- Ottimizzazioni UX
- Empty states, validazioni avanzate

---

## 🎬 User Journey Storyboard: "Mario crea la sua prima campagna"

### Persona: **Mario**
- **Ruolo**: Sales Manager presso "ACME Srl"
- **Obiettivo**: Lanciare una campagna outbound per qualificare lead
- **Livello tecnico**: Intermedio (usa HubSpot, CRM, email marketing)
- **Prima volta** su Agoralia

---

### **FASE 1: Registrazione e Primo Accesso**

**Tempo**: Giorno 1, 10:00 AM

**1.1. Mario si registra**
- Inserisce email, password, nome azienda ("ACME Srl")
- Conferma email
- ✅ **Accede a `/` (Dashboard)**

**1.2. Dashboard mostra setup incompleto**
```
┌─────────────────────────────────────────┐
│ Dashboard                                │
│                                          │
│ ⚠️ Setup incompleto                      │
│                                          │
│ Per lanciare la prima campagna:         │
│                                          │
│ ⚠️ Numero telefonico  [Completa ora →] │
│ ⚠️ Knowledge Base     [Completa ora →] │
│ ⚠️ Agent              [Completa ora →] │
│ ⚠️ Leads              [Completa ora →] │
│                                          │
│ Progress: 0/4 completati                 │
│                                          │
│ [Inizia Setup] (pulsante grande)        │
└─────────────────────────────────────────┘
```

**Pensiero di Mario**: "Ok, devo completare questi 4 step. Sembra chiaro."

**Azione**: Clicca "Inizia Setup" → redirect a `/setup`

---

### **FASE 2: Setup Wizard (4 Step)**

**Tempo**: Giorno 1, 10:05 AM - 10:45 AM

**2.1. Step 1: Numero Telefonico** (`/setup/phone`)

```
┌─────────────────────────────────────────┐
│ Setup - Step 1/4: Numero Telefonico    │
│ ████████░░░░░░░░░░░░░░░░░░░░ 25%        │
│                                          │
│ 📞 Numero Telefonico                    │
│                                          │
│ Per chiamare i tuoi clienti serve      │
│ almeno un numero attivo.                │
│                                          │
│ Lista numeri:                           │
│ (Vuota)                                 │
│                                          │
│ [Aggiungi Numero]                       │
│                                          │
│ [← Indietro] [Salta questo step] [→ Prossimo] │
└─────────────────────────────────────────┘
```

**Azione**: Clicca "Aggiungi Numero"
- Modal si apre: form per selezionare paese, tipo numero
- Seleziona: Italia, Numero mobile, "+39..."
- Salva → Numero aggiunto (stato: "pending verification")

**Feedback**: ✅ "Numero aggiunto! In verifica..." + Toast

**Azione**: Clicca "Prossimo" → `/setup/knowledge`

---

**2.2. Step 2: Knowledge Base** (`/setup/knowledge`)

```
┌─────────────────────────────────────────┐
│ Setup - Step 2/4: Knowledge Base       │
│ ████████████████░░░░░░░░░░░░ 50%        │
│                                          │
│ 📚 Knowledge Base                       │
│                                          │
│ La KB fornisce informazioni al tuo     │
│ agent durante le chiamate.              │
│                                          │
│ Lista KB:                               │
│ (Vuota)                                 │
│                                          │
│ [Crea Knowledge Base]                   │
│                                          │
│ [← Indietro] [Salta] [→ Prossimo]       │
└─────────────────────────────────────────┘
```

**Azione**: Clicca "Crea Knowledge Base"
- Modal: nome ("Product Info"), upload PDF catalogo prodotti
- Salva → KB creata (stato: "syncing")

**Feedback**: ✅ "KB creata! Sincronizzazione in corso..."

**Azione**: Clicca "Prossimo" → `/setup/agent`

---

**2.3. Step 3: Agent** (`/setup/agent`)

```
┌─────────────────────────────────────────┐
│ Setup - Step 3/4: Agent                │
│ ████████████████████████░░░░ 75%        │
│                                          │
│ 🤖 Agent                                │
│                                          │
│ L'agent è la voce AI che farà le       │
│ chiamate per te.                        │
│                                          │
│ Lista agenti:                           │
│ (Vuota)                                 │
│                                          │
│ [Crea Agent]                            │
│                                          │
│ [← Indietro] [Salta] [→ Prossimo]       │
└─────────────────────────────────────────┘
```

**Azione**: Clicca "Crea Agent"
- Form: nome ("Sales IT"), language ("it-IT"), voice ("Chiara"), instructions
- Salva → Agent creato

**Feedback**: ✅ "Agent creato!"

**Azione**: Clicca "Prossimo" → `/setup/leads`

---

**2.4. Step 4: Leads** (`/setup/leads`)

```
┌─────────────────────────────────────────┐
│ Setup - Step 4/4: Leads                │
│ ████████████████████████████████ 100%   │
│                                          │
│ 👥 Leads                                │
│                                          │
│ I leads sono i contatti che            │
│ riceveranno le chiamate.                │
│                                          │
│ Lista leads:                            │
│ (Vuota)                                 │
│                                          │
│ [Importa CSV] [Aggiungi Manualmente]    │
│                                          │
│ [← Indietro] [Salta] [Completa Setup]   │
└─────────────────────────────────────────┘
```

**Azione**: Clicca "Importa CSV"
- Upload CSV con: nome, telefono, email, note
- Preview dati → Conferma import
- ✅ 150 leads importati

**Feedback**: ✅ "150 leads importati!"

**Azione**: Clicca "Completa Setup" → redirect a `/` (Dashboard)

---

### **FASE 3: Setup Completato - Dashboard**

**Tempo**: Giorno 1, 10:45 AM

**3.1. Dashboard ora mostra setup completo**

```
┌─────────────────────────────────────────┐
│ Dashboard                                │
│                                          │
│ ✅ Sistema pronto per chiamare          │
│                                          │
│ KPIs:                                   │
│ ┌─────────────┐ ┌─────────────┐        │
│ │ Chiamate    │ │ Costo oggi  │        │
│ │ attive: 0   │ │ €0.00       │        │
│ └─────────────┘ └─────────────┘        │
│                                          │
│ [Crea Campagna] (pulsante grande)       │
│                                          │
│ Checklist Setup:                        │
│ ✅ Numero telefonico                    │
│ ✅ Knowledge Base                       │
│ ✅ Agent                                │
│ ✅ Leads (150)                          │
│                                          │
│ Chiamate live:                          │
│ (Nessuna chiamata attiva)               │
└─────────────────────────────────────────┘
```

**Pensiero di Mario**: "Perfetto! Ora posso creare una campagna."

**Azione**: Clicca "Crea Campagna" → redirect a `/campaigns/new`

---

### **FASE 4: Creazione Campagna**

**Tempo**: Giorno 1, 10:46 AM

**4.1. Wizard Creazione Campagna** (`/campaigns/new`)

**Step 1: Nome e Date**
```
┌─────────────────────────────────────────┐
│ Crea Campagna - Step 1/4               │
│ ████░░░░░░░░░░░░░░░░░░░░░░░░ 25%       │
│                                          │
│ Nome campagna: [Q4 Lead Qualification] │
│                                          │
│ Data inizio: [2025-01-20] [10:00]     │
│ Data fine:   [2025-02-20] [18:00]     │
│                                          │
│ Timezone: [Europe/Rome ▾]              │
│                                          │
│ [Indietro] [Prossimo →]                 │
└─────────────────────────────────────────┘
```

**Azione**: Compila form → Clicca "Prossimo"

---

**Step 2: Seleziona Mattoni**
```
┌─────────────────────────────────────────┐
│ Crea Campagna - Step 2/4               │
│ ████████████░░░░░░░░░░░░░░░░ 50%       │
│                                          │
│ Seleziona i mattoni:                   │
│                                          │
│ ✅ Numero: [+39 123...] ▾              │
│                                          │
│ ✅ Knowledge Base: [Product Info] ▾    │
│                                          │
│ ✅ Agent: [Sales IT] ▾                 │
│                                          │
│ ✅ Leads: [150 leads selezionati]      │
│    [Cambia selezione →]                │
│                                          │
│ [← Indietro] [Prossimo →]               │
└─────────────────────────────────────────┘
```

**Pensiero di Mario**: "Perfetto, tutti i mattoni sono disponibili!"

**Azione**: Conferma selezione → Clicca "Prossimo"

**💡 Scenario alternativo: Se manca un mattone**

```
┌─────────────────────────────────────────┐
│ ⚠️ Nessun agent disponibile             │
│                                          │
│ Devi creare almeno un agent per        │
│ questa campagna.                        │
│                                          │
│ [Crea un agent adesso] (modal)          │
│                                          │
│ Modal si apre → crea agent →           │
│ dropdown si aggiorna automaticamente    │
└─────────────────────────────────────────┘
```

**Azione**: Crea agent inline → Continua wizard senza uscire

---

**Step 3: Impostazioni**
```
┌─────────────────────────────────────────┐
│ Crea Campagna - Step 3/4               │
│ ████████████████████████░░░░ 75%       │
│                                          │
│ Impostazioni:                          │
│                                          │
│ Budget: [€500]                         │
│ Max chiamate/giorno: [50]              │
│                                          │
│ Quiet Hours:                           │
│ ✅ Attive (09:00-21:00, L-V)          │
│                                          │
│ [← Indietro] [Prossimo →]               │
└─────────────────────────────────────────┘
```

**Azione**: Compila impostazioni → Clicca "Prossimo"

---

**Step 4: Review & Launch**
```
┌─────────────────────────────────────────┐
│ Crea Campagna - Step 4/4               │
│ ████████████████████████████████ 100%   │
│                                          │
│ Riepilogo:                             │
│                                          │
│ Nome: Q4 Lead Qualification            │
│ Date: 20 Gen - 20 Feb 2025             │
│                                          │
│ ✅ Numero: +39 123...                  │
│ ✅ KB: Product Info                    │
│ ✅ Agent: Sales IT                     │
│ ✅ Leads: 150                          │
│                                          │
│ Budget: €500                           │
│                                          │
│ [← Indietro] [Crea Campagna]            │
└─────────────────────────────────────────┘
```

**Azione**: Clicca "Crea Campagna" → Toast: ✅ "Campagna creata!" → redirect a `/campaigns/:id`

---

### **FASE 5: Monitoraggio Campagna**

**Tempo**: Giorno 1, 10:50 AM - Giorno 2, 18:00

**5.1. Dettaglio Campagna** (`/campaigns/:id`)

```
┌─────────────────────────────────────────┐
│ Q4 Lead Qualification                   │
│                                          │
│ ✅ Campagna pronta per partire          │
│                                          │
│ Tab: [Configurazione] [Leads] [Risultati] │
│                                          │
│ [Configurazione]                        │
│                                          │
│ Badge Mattoni:                          │
│ ✅ Numero: +39 123... (IT, 09:00-21:00)│
│ ✅ Agent: Sales IT (IT, Voce Chiara)   │
│ ✅ KB: Product Info                    │
│ ✅ Leads: 150 leads assegnati          │
│                                          │
│ Budget: €500                            │
│ Max chiamate/giorno: 50                │
│                                          │
│ [Avvia Campagna] [Modifica]             │
└─────────────────────────────────────────┘
```

**Azione**: Clicca "Avvia Campagna" → Stato cambia a "running" → Campagna parte

---

**5.2. Monitoraggio in tempo reale**

**Dashboard** mostra:
- Chiamate attive: 3
- Costo oggi: €12.50

**Calls** (`/calls`) con filtri:
- Filtro Campaign: "Q4 Lead Qualification"
- Vede lista chiamate in tempo reale:
  - ✅ Chiamata 1: Esito "Qualified lead"
  - ⚠️ Chiamata 2: Esito "No answer"
  - ✅ Chiamata 3: Esito "Qualified lead"

**Pensiero di Mario**: "Ottimo! Le chiamate stanno partendo e vedo i risultati in tempo reale."

---

### **FASE 6: Analisi Risultati**

**Tempo**: Giorno 2, 18:00

**6.1. Dettaglio Campagna - Tab Risultati**

```
┌─────────────────────────────────────────┐
│ Q4 Lead Qualification                   │
│                                          │
│ [Risultati]                             │
│                                          │
│ Statistiche:                            │
│ - Chiamate fatte: 127/150               │
│ - Successo: 45 (35%)                    │
│ - Spesa: €387.50 / €500                 │
│                                          │
│ Grafici temporali:                      │
│ (Grafici chiamate/giorno, successo)    │
│                                          │
│ Lista chiamate:                         │
│ - Vedi dettaglio singola chiamata      │
│   (transcript, audio, outcome)          │
└─────────────────────────────────────────┘
```

**Pensiero di Mario**: "35% di successo, non male! Posso vedere quali chiamate sono andate bene."

---

## 🎯 Punti Chiave dello Storyboard

### **Flussi Fluidi**
- ✅ Setup wizard guida step-by-step senza confusione
- ✅ Creazione campagna inline se manca un mattone (non blocca)
- ✅ Dashboard mostra sempre stato "pronto/non pronto"

### **Feedback Chiari**
- ✅ Toast messages per ogni azione
- ✅ Badge visivi per stato mattoni
- ✅ Progress bar in wizard
- ✅ Empty states con CTA chiari

### **Coerenza**
- ✅ Ordine fisso mattoni ovunque (Numero → KB → Agent → Leads)
- ✅ Stessa iconografia e naming
- ✅ Stesso pattern di selezione mattoni

### **Non Blocchi**
- ✅ Se manca un mattone → creazione inline, non errore
- ✅ Skip step già completati
- ✅ Salvataggio automatico

---

## 🔍 Validazione: Dove Potrebbero Esserci Buchi?

### **Scenario 1: Mario salta lo step Leads**
- ✅ Wizard permette skip
- ✅ Dashboard mostra "Leads mancanti"
- ✅ Wizard campagna permette import inline

### **Scenario 2: Numero non verificato**
- ✅ **Implementato**: Badge "Numero in verifica" + banner avviso se si prova a lanciare campagna
  - In `/numbers`: badge chiaro `Pending verification`, `Active`, `Error`
  - In campagna: banner `⚠️ Il numero selezionato non è attivo. La campagna non può partire finché il numero non è attivo.`
- ✅ Campagna non parte se numero non attivo

### **Scenario 3: Mario crea campagna senza completare setup**
- ✅ Dashboard mostra "Setup incompleto"
- ✅ Wizard campagna permette creazione inline dei mattoni mancanti

### **Scenario 4: Mario vuole modificare un mattone**
- ✅ Link a pagina dedicata (`/agents`, `/numbers`, ecc.)
- ✅ Modifiche si riflettono automaticamente nelle campagne (se non running)

---

---

## 🔧 Micro-Migliorie (Polish)

### **1. Stato dei Numeri (Verificato vs Non Verificato)**

**Problema**: Un numero potrebbe essere "in verifica" / "pending" / "failed"

**Soluzione**:
- In `/numbers`:
  - Badge chiaro: `Pending verification`, `Active`, `Error`
  - Colori: ⚠️ Giallo (pending), ✅ Verde (active), ❌ Rosso (error)
- In campagna:
  - Se numero selezionato non è `Active`:
    - Banner tipo: `⚠️ Il numero selezionato non è attivo. La campagna non può partire finché il numero non è attivo.`
  - Disabilita pulsante "Avvia Campagna" se numero non attivo

**Pattern UX**: Evita "perché non parte?" → la UI lo dice chiaramente

---

### **2. Stato della Knowledge Base (Sync/Non Sync)**

**Problema**: KB può essere `Syncing`, `Ready`, `Error`

**Soluzione**:
- In `/knowledge`:
  - Badge chiaro: `Syncing`, `Ready`, `Error`
  - Progress bar se syncing: "Sincronizzazione 45%..."
- In selezione wizard campagna:
  - Disabilita KB non pronte (`Syncing`, `Error`) nel dropdown
  - Oppure messaggio: `⚠️ Questa KB è ancora in sincronizzazione, potrebbe non essere usata correttamente per le chiamate.`
  - Solo `Ready` KB sono selezionabili

**Pattern UX**: Evita chiamate con KB non sincronizzata

---

### **3. Performance su Liste Grandi**

**Problema**: `/leads` e `/calls` con migliaia di righe

**Soluzione**:
- **Pagination**:
  - Infinite scroll o "Load more" button
  - Opzionale: pagination tradizionale (10/25/50/100 per pagina)
- **Filtri in URL**:
  - Salvataggio filtri in URL params: `/calls?campaign=123&outcome=success&date=2025-01-20`
  - Refresh non resetta filtri
  - Condivisibile via URL
- **Default view intelligente**:
  - `/calls`: default ultime 24h
  - `/leads`: default ordine per ultimo aggiornamento
- **Virtual scrolling** per liste > 1000 righe

**Pattern UX**: Evita lag e reset filtri al refresh

---

### **4. Ruoli / Permessi (Future Enhancement)**

**Problema**: Team con ruoli diversi (admin, viewer, editor)

**Soluzione**:
- **Ruoli**:
  - `Admin`: tutto
  - `Editor`: crea/modifica campagne, vedi tutto
  - `Viewer`: vedi campagne/calls, no modifica
- **UI**:
  - Nascondere bottoni non permessi: `{canEdit && <Button>Modifica</Button>}`
  - Oppure mostrarli disattivi con tooltip: `<Button disabled title="Non hai i permessi per modificare">Modifica</Button>`
- **Filtri automatici**:
  - `Viewer` vede solo campagne/calls assegnate al suo team

**Pattern UX**: UX adattiva basata su permessi

---

### **5. Mobile / Schermi Piccoli**

**Problema**: Struttura ottimizzata per desktop, mobile potrebbe essere difficile

**Soluzione**:
- **Dashboard**:
  - ✅ OK: Grid KPIs si adatta a colonna singola
  - ✅ OK: Checklist verticale funziona bene
- **Wizard Setup**:
  - ✅ OK: Step verticali funzionano bene mobile
  - ✅ OK: Progress bar sempre visibile
- **Campagne / Calls con tabelle**:
  - ⚠️ **Da adattare**:
    - Colonne ridotte (solo essenziali: Nome, Stato, Azioni)
    - Accordion mobile (tap per espandere dettagli)
    - Swipe actions (swipe per modifica/elimina)
    - Filtri in drawer/collapsibile invece che sidebar

**Pattern UX**: Mobile-first responsive, breakpoint a 768px

---

## 🚀 Prossimi Passi

1. ✅ Validare storyboard con utenti reali
2. ✅ Implementare pattern di creazione inline
3. ✅ Aggiungere validazioni avanzate (numero verificato, KB sync, ecc.)
4. ✅ Implementare multi-tenant selector (se presente)
5. ✅ Aggiungere analytics avanzate (tab Risultati campagna)
6. ✅ Implementare micro-migliorie (stato numeri, KB sync, performance)
7. ✅ Aggiungere ruoli/permessi (future)
8. ✅ Ottimizzare mobile/responsive (future)

