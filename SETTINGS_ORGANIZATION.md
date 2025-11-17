# Organizzazione Settings - Agoralia

## 📍 Principio Fondamentale

**Le Settings contengono solo CONFIGURAZIONI DI DEFAULT/COMPORTAMENTO, NON la gestione CRUD delle risorse.**

## ✅ Cosa va nelle Settings

### Workspace Settings (Admin only)

1. **General**
   - `workspace_name` - Nome del workspace
   - `timezone` - Timezone del workspace
   - `brand_logo_url` - Logo del workspace (upload o URL)

2. **Telephony** ⚠️ **Solo defaults, non CRUD**
   - `default_agent_id` - **Dropdown** per selezionare agent esistente (da `/agents`)
   - `default_from_number` - **Dropdown** per selezionare numero esistente (da `/numbers`)
   - `default_spacing_ms` - Spaziatura default tra chiamate

3. **Budget**
   - `budget_monthly_cents` - Budget mensile in centesimi
   - `budget_warn_percent` - Percentuale di warning (es. 80%)
   - `budget_stop_enabled` - Se fermare automaticamente al budget

4. **Compliance** ⚠️ **Solo configurazione comportamento, non regole**
   - `require_legal_review` - Se richiedere review legale
   - `override_country_rules_enabled` - Se permettere override regole paese
   - **NOTA**: Le regole paese (CountryRule) e DNC vanno gestite in `/compliance`

5. **Quiet Hours**
   - `quiet_hours_enabled` - Se abilitare quiet hours
   - `quiet_hours_weekdays` - Orari giorni feriali (es. "09:00-21:00")
   - `quiet_hours_saturday` - Orari sabato ("09:00-21:00" | "forbidden")
   - `quiet_hours_sunday` - Orari domenica ("forbidden" | "09:00-21:00")
   - `quiet_hours_timezone` - Timezone per quiet hours

6. **Integrations**
   - `retell_api_key` - API key Retell (encrypted)
   - `retell_webhook_secret` - Webhook secret Retell (encrypted)

### User Preferences (Ogni utente)

1. **UI**
   - `theme` - light/dark/system
   - `ui_locale` - Lingua UI (override workspace)
   - `date_format` - Formato data (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
   - `time_format` - Formato ora (24h, 12h)
   - `timezone` - Timezone personale (override workspace)

2. **Notifications**
   - `email_notifications_enabled` - Se abilitare notifiche email
   - `email_campaign_started` - Notifica quando campagna inizia
   - `email_campaign_paused` - Notifica quando campagna pausata
   - `email_budget_warning` - Notifica warning budget
   - `email_compliance_alert` - Notifica alert compliance

3. **Dashboard**
   - `default_view` - Vista default (campaigns/calls/dashboard)
   - `table_page_size` - Dimensione pagina tabelle (10-200)

## ❌ Cosa NON va nelle Settings

### Gestione CRUD Risorse (hanno pagine dedicate)

1. **Agents** → `/agents`
   - Creare, modificare, eliminare agents
   - Nelle Settings: solo **dropdown** per selezionare `default_agent_id`

2. **Phone Numbers** → `/numbers`
   - Creare, modificare, eliminare numeri
   - Nelle Settings: solo **dropdown** per selezionare `default_from_number`

3. **Knowledge Bases** → `/knowledge`
   - Creare, modificare, eliminare KB
   - NON va nelle Settings (non c'è default KB)

4. **Leads** → `/leads`
   - Importare, modificare, eliminare leads
   - NON va nelle Settings

5. **Campaigns** → `/campaigns`
   - Creare, modificare, eliminare campagne
   - NON va nelle Settings

6. **Calls** → `/calls`
   - Visualizzare, ascoltare chiamate
   - NON va nelle Settings

7. **Compliance Rules** → `/compliance`
   - Gestire CountryRule, DNCEntry, Consent
   - Nelle Settings: solo **configurazione comportamento** (require_legal_review, override_enabled)

## 🎯 Implementazione

### Telephony Section
```typescript
// ✅ CORRETTO: Dropdown da lista esistente
<Select>
  {agents.map(agent => (
    <option value={agent.id}>{agent.name}</option>
  ))}
</Select>

// ❌ SBAGLIATO: Form per creare nuovo agent
<Input placeholder="Create new agent..." />
```

### Compliance Section
```typescript
// ✅ CORRETTO: Toggle per comportamento
<Switch checked={require_legal_review} />

// ❌ SBAGLIATO: Form per creare CountryRule
<Form>...</Form>
```

## 📝 Note

- Le Settings sono per **configurare il comportamento** del sistema
- Le pagine dedicate sono per **gestire le risorse** (CRUD)
- Quando serve una risorsa nelle Settings, usare sempre dropdown/select da lista esistente
- Linkare alle pagine dedicate quando serve creare nuova risorsa: "No agents? [Create one](/agents)"

