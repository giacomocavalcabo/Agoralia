# Architettura Sistema Settings - Agoralia

## 📋 1. Analisi Situazione Attuale

### 1.1 Problemi Identificati

1. **Settings non multi-tenant**: `get_settings()` prende solo il primo record senza filtrare per `tenant_id`
2. **Mancanza di preferenze utente**: Non esistono settings personali (theme, notifications, UI preferences)
3. **Separazione non chiara**: Settings operativi (workspace) e preferenze personali (user) sono mescolati
4. **UI mancante**: Non c'è una pagina Settings nel frontend
5. **API incomplete**: Endpoint esistenti ma non utilizzano correttamente il multi-tenancy

### 1.2 Struttura Attuale

**Backend:**
- `AppSettings` (tabella `settings`): Settings operativi con `tenant_id` nullable
- `AppMeta` (tabella `app_meta`): Metadata workspace (name, timezone, brand)
- `get_settings()`: Prende primo record senza filtrare per tenant
- Endpoint `/settings/*`: Esistono ma non sono multi-tenant aware

**Frontend:**
- Nessuna pagina Settings
- Nessuna gestione preferenze utente

### 1.3 Nota Importante: tenant_id e Nome Utente

- **`tenant_id`** è un valore logico (Integer) usato per isolamento multi-tenant, **NON** una FK su `users.id`
- L'utente vede il suo **nome** (es. "Benvenuto Giacomo"), non il tenant_id
- Il tenant_id serve per organizzazione dati e chiamate API, ma l'UI mostra sempre il nome dell'utente
- Un workspace può avere più utenti, tutti con lo stesso `tenant_id`

---

## 🎯 2. Obiettivo del Sistema Settings

### 2.1 Cosa Deve Fare

1. **Workspace Settings (tenant-level)**: Configurazioni che si applicano a tutto il workspace
   - Default agent, number, spacing
   - Budget e limiti
   - Quiet hours default
   - Compliance configuration (come usare CountryRule, non le regole stesse)
   - Branding (logo, colori)
   - Integrazioni (Retell API key, webhooks)

2. **User Preferences (user-level)**: Preferenze personali dell'utente
   - Theme (light/dark/system)
   - Language/UI locale
   - Notifications preferences
   - Dashboard layout preferences
   - Table pagination size
   - Date/time format

3. **UI Settings Page**: Interfaccia per gestire entrambi i tipi di settings
   - L'utente vede sempre il suo nome, non il tenant_id
   - Save per sezione (non globale)
   - Feedback immediato (toast, unsaved changes warning)

---

## 🏗️ 3. Architettura Proposta

### 3.1 Modello Dati

```python
# Workspace Settings (tenant-level)
class WorkspaceSettings(Base):
    __tablename__ = "workspace_settings"
    
    id: int (PK)
    tenant_id: int (Integer, NOT NULL, UNIQUE)  # Valore logico per isolamento, NON FK
    # Operative
    default_agent_id: Optional[str]
    default_from_number: Optional[str]
    default_spacing_ms: int (default: 1000)
    # Budget
    budget_monthly_cents: Optional[int]
    budget_warn_percent: int (default: 80)
    budget_stop_enabled: bool (default: true)
    # Quiet Hours Default
    quiet_hours_enabled: bool (default: false)
    quiet_hours_weekdays: Optional[str]  # "09:00-21:00"
    quiet_hours_saturday: Optional[str]  # "09:00-21:00" | "forbidden"
    quiet_hours_sunday: Optional[str]    # "forbidden" | "09:00-21:00"
    quiet_hours_timezone: Optional[str]  # "Europe/Rome"
    # Compliance Configuration (come usare CountryRule, non le regole stesse)
    require_legal_review: bool (default: true)
    override_country_rules_enabled: bool (default: false)  # Permette override regole paese
    # Language/Agent
    default_lang: Optional[str]  # "it-IT", "en-US"
    supported_langs_json: Optional[str]  # JSON array (JSONB in Postgres)
    prefer_detect_language: bool (default: false)
    kb_version_outbound: int (default: 0)  # Per invalidare cache KB
    kb_version_inbound: int (default: 0)
    # Branding
    workspace_name: Optional[str]
    timezone: Optional[str]  # "Europe/Rome"
    brand_logo_url: Optional[str]
    brand_color: Optional[str]  # "#10a37f"
    # Integrations
    retell_api_key_encrypted: Optional[str]  # BYO Retell (encrypted at rest)
    retell_webhook_secret_encrypted: Optional[str]  # For signature verification (encrypted)
    # Metadata
    created_at: datetime
    updated_at: datetime

# User Preferences (user-level)
class UserPreferences(Base):
    __tablename__ = "user_preferences"
    
    id: int (PK)
    user_id: int (FK → users.id, NOT NULL, UNIQUE)  # Un solo record per user
    tenant_id: int (Integer, NOT NULL)  # Valore logico per isolamento, NON FK
    # UI/UX
    theme: str (default: "system")  # "light" | "dark" | "system"
    ui_locale: Optional[str]  # "it-IT", "en-US" (override workspace default)
    # Notifications
    email_notifications_enabled: bool (default: true)
    email_campaign_started: bool (default: true)
    email_campaign_paused: bool (default: true)
    email_budget_warning: bool (default: true)
    email_compliance_alert: bool (default: true)
    # Dashboard
    dashboard_layout: Optional[str]  # JSONB con layout preferences
    default_view: Optional[str]  # "campaigns" | "calls" | "dashboard"
    # Table Preferences
    table_page_size: int (default: 50)
    table_sort_preferences: Optional[str]  # JSONB
    # Date/Time
    date_format: Optional[str]  # "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
    time_format: Optional[str]  # "24h" | "12h"
    timezone: Optional[str]  # Override workspace timezone
    # Metadata
    created_at: datetime
    updated_at: datetime
```

**Note Importanti:**
- `tenant_id` è un **valore logico** (Integer), NON una FK. Serve per isolamento multi-tenant.
- Le regole compliance dettagliate restano in `CountryRule` (già esistente). `WorkspaceSettings` contiene solo configurazione su **come usare** quelle regole.
- JSON fields usano **JSONB** in Postgres per performance e query.
- API keys sono **encrypted at rest** (vedi sezione Security).

### 3.2 Servizi Backend

```python
# services/settings.py

def get_workspace_settings(tenant_id: int) -> WorkspaceSettings:
    """Get workspace settings for a tenant, create if not exists"""
    # Filtra per tenant_id (valore logico)
    
def update_workspace_settings(tenant_id: int, updates: Dict) -> WorkspaceSettings:
    """Update workspace settings (partial update)"""
    
def get_user_preferences(user_id: int, tenant_id: int) -> UserPreferences:
    """Get user preferences, create if not exists"""
    # Filtra per user_id E tenant_id (isolamento)
    
def update_user_preferences(user_id: int, tenant_id: int, updates: Dict) -> UserPreferences:
    """Update user preferences (partial update)"""

# Resolver per settings effettivi (workspace + user override)
class EffectiveSettings(BaseModel):
    """Settings effettivi risolti (workspace + user override)"""
    timezone: str
    locale: str
    date_format: str
    time_format: str
    theme: str
    # ... altri campi risolti

def get_effective_settings(user_id: int, tenant_id: int) -> EffectiveSettings:
    """
    Risolve settings effettivi:
    - UserPreferences ha priorità su WorkspaceSettings
    - Fallback a valori di default se mancanti
    
    Algoritmo esempio per timezone:
    1. UserPreferences.timezone (se presente)
    2. WorkspaceSettings.timezone (se presente)
    3. Fallback "UTC"
    """
    workspace = get_workspace_settings(tenant_id)
    user_prefs = get_user_preferences(user_id, tenant_id)
    
    return EffectiveSettings(
        timezone=user_prefs.timezone or workspace.timezone or "UTC",
        locale=user_prefs.ui_locale or workspace.default_lang or "en-US",
        # ... altri campi
    )
```

### 3.3 API Endpoints

```python
# routes/settings.py

# Workspace Settings (solo admin tenant)
GET    /settings/workspace          # Get workspace settings
PATCH  /settings/workspace          # Partial update workspace settings
GET    /settings/workspace/general  # General (name, timezone, brand)
PATCH  /settings/workspace/general
GET    /settings/workspace/telephony # Telephony (agent, number, spacing)
PATCH  /settings/workspace/telephony
GET    /settings/workspace/budget   # Budget settings
PATCH  /settings/workspace/budget
GET    /settings/workspace/compliance # Compliance configuration
PATCH  /settings/workspace/compliance
GET    /settings/workspace/quiet-hours # Quiet hours
PATCH  /settings/workspace/quiet-hours
GET    /settings/workspace/integrations # Integrations (Retell API key)
PATCH  /settings/workspace/integrations
# Nota: GET /integrations ritorna solo "retell_api_key_set": true/false
# Non ritorna il valore completo per sicurezza

# User Preferences (ogni utente può modificare le proprie)
GET    /settings/preferences        # Get user preferences
PATCH  /settings/preferences        # Partial update user preferences
GET    /settings/preferences/ui    # UI preferences (theme, locale)
PATCH  /settings/preferences/ui
GET    /settings/preferences/notifications # Notification preferences
PATCH  /settings/preferences/notifications

# Effective Settings (resolver)
GET    /settings/effective          # Get effective settings (workspace + user resolved)
```

**Note:**
- Usiamo **PATCH** invece di PUT per update parziali
- Non richiediamo tutti i campi, solo quelli da aggiornare
- Non resettiamo campi non mandati a `null`

### 3.4 Frontend Structure

```
src/features/settings/
├── api.ts                    # API functions
├── hooks.ts                  # TanStack Query hooks
├── types.ts                  # TypeScript types
├── utils/
│   └── resolver.ts           # Client-side resolver per effective settings
├── components/
│   ├── SettingsLayout.tsx    # Layout con sidebar per sezioni
│   ├── WorkspaceSettings/
│   │   ├── GeneralSection.tsx
│   │   ├── TelephonySection.tsx
│   │   ├── BudgetSection.tsx
│   │   ├── ComplianceSection.tsx
│   │   ├── QuietHoursSection.tsx
│   │   └── IntegrationsSection.tsx
│   └── UserPreferences/
│       ├── UISection.tsx
│       ├── NotificationsSection.tsx
│       └── DashboardSection.tsx
└── pages/
    └── SettingsPage.tsx      # Main settings page
```

**Integrazione con AppProviders:**
- `useUserPreferences()` hook legge `theme` e `ui_locale` all'avvio
- Applica tema (class `dark`) e setta lingua i18n
- Usa `get_effective_settings()` per risolvere workspace + user

---

## 📊 4. Categorizzazione Settings

### 4.1 Workspace Settings (Tenant-Level)

#### **General**
- Workspace name
- Timezone
- Branding (logo URL, brand color)

#### **Telephony**
- Default agent ID
- Default from number
- Default spacing (ms)

#### **Budget**
- Monthly budget (cents)
- Budget warning percentage
- Budget stop enabled

#### **Compliance Configuration**
- Require legal review
- Override country rules enabled
- **NOTA**: Le regole dettagliate per paese restano in `CountryRule` (già esistente)

#### **Quiet Hours**
- Enabled/disabled
- Weekdays hours
- Saturday hours
- Sunday hours
- Timezone

#### **Language/Agent**
- Default language
- Supported languages
- Prefer detect language
- KB versions (outbound/inbound) - per invalidare cache

#### **Integrations**
- Retell API key (BYO) - encrypted
- Retell webhook secret - encrypted
- **NOTA**: GET ritorna solo `retell_api_key_set: true/false`, non il valore

### 4.2 User Preferences (User-Level)

#### **UI/UX**
- Theme (light/dark/system)
- UI locale (override workspace)
- Date format
- Time format
- Timezone (override workspace)

#### **Notifications**
- Email notifications enabled
- Campaign started
- Campaign paused
- Budget warning
- Compliance alert

#### **Dashboard**
- Layout preferences (JSONB)
- Default view
- Widget preferences

#### **Table Preferences**
- Page size
- Sort preferences (JSONB)

---

## 🔄 5. Migrazione da Sistema Attuale

### 5.1 Strategia

1. **Creare nuove tabelle**: `workspace_settings` e `user_preferences`
2. **Migrare dati esistenti**: 
   - Da `settings` → `workspace_settings` (per ogni tenant esistente)
   - Da `app_meta` → `workspace_settings` (workspace_name, timezone, brand)
3. **Backfill**: Creare record `workspace_settings` per tutti i tenant esistenti (anche con default)
4. **Aggiornare servizi**: `get_settings()` → `get_workspace_settings(tenant_id)`
5. **Aggiornare tutti i riferimenti**: Cercare tutti i `get_settings()` e aggiornare
6. **User preferences**: Creare lazy (solo alla prima chiamata), non serve backfill
7. **Deprecare vecchie tabelle**: Mantenere per backward compatibility, poi rimuovere

### 5.2 Script di Migrazione

```python
# migrations/XXXX_add_workspace_user_settings.py

def upgrade():
    # 1. Create workspace_settings table (con JSONB, encryption columns)
    # 2. Create user_preferences table (con JSONB)
    # 3. Migrate data from settings + app_meta to workspace_settings
    #    - Per ogni tenant_id unico in users, creare workspace_settings
    #    - Se tenant_id è NULL in settings vecchi, creare per ogni tenant esistente
    # 4. User preferences: non serve backfill, creati lazy
```

---

## 🎨 6. UI/UX Design

### 6.1 Layout Settings Page

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                    [User: Giacomo] │
├──────────────┬──────────────────────────────────────────┤
│              │                                           │
│  Workspace   │  General                          [Save] │
│  Settings    │  ──────────────────────────────────────  │
│              │  Workspace name: [____________]           │
│  • General   │  Timezone: [Europe/Rome ▼]              │
│  • Telephony │  Brand color: [#10a37f]                │
│  • Budget    │  Logo URL: [____________]               │
│  • Compliance│                                           │
│  • Quiet Hours│                                          │
│  • Integrations│                                         │
│              │                                           │
│  ─────────── │                                           │
│              │                                           │
│  Preferences │                                           │
│              │                                           │
│  • UI        │                                           │
│  • Notifications│                                        │
│  • Dashboard │                                           │
└──────────────┴──────────────────────────────────────────┘
```

**Caratteristiche:**
- Header mostra nome utente (es. "User: Giacomo"), non tenant_id
- **Save per sezione** (non globale)
- Warning se ci sono modifiche non salvate quando si cambia sezione
- Toast "Impostazioni salvate" dopo save
- Disabilita pulsante Save mentre salva
- Se utente non è admin, disabilita/nascondi sezioni Workspace Settings

### 6.2 Sezioni Settings

Ogni sezione:
- Card con titolo e descrizione
- Form fields con labels chiare
- **Save button per sezione** (non globale)
- Validation e error handling
- Success toast dopo save
- Unsaved changes warning

---

## 🔐 7. Security & Permissions

### 7.1 Permissions

- **Workspace Settings**: Solo admin del tenant può modificare
  - Verificare `is_admin` dal JWT
  - Validare `tenant_id` dal JWT
- **User Preferences**: Ogni utente può modificare solo le proprie
  - Validare `user_id` e `tenant_id` dal JWT

### 7.2 Encryption per API Keys

**Sensitive data:**
- `retell_api_key_encrypted`
- `retell_webhook_secret_encrypted`

**Strategia:**
1. **Encryption at rest**: Usare `cryptography.fernet` o `pgcrypto`
   - Chiave di encryption in env var (`ENCRYPTION_KEY`)
   - Encrypt prima di salvare, decrypt quando serve
2. **API Response**: Mai mandare valore completo
   - GET `/settings/workspace/integrations` ritorna:
     ```json
     {
       "retell_api_key_set": true,
       "retell_webhook_secret_set": true
     }
     ```
   - UI mostra "Key configurata / non configurata"
   - Bottone "Reimposta" per cambiare (richiede conferma)

### 7.3 Validation

- Workspace settings: Validare `tenant_id` dal JWT
- User preferences: Validare `user_id` e `tenant_id` dal JWT
- Input validation: Validare tutti i campi prima di salvare
- JSON fields: Validare struttura JSON prima di salvare

---

## 🔧 8. Resolver per Settings Effettivi

### 8.1 Algoritmo di Risoluzione

```python
def get_effective_settings(user_id: int, tenant_id: int) -> EffectiveSettings:
    """
    Risolve settings effettivi con priorità:
    1. UserPreferences (se presente)
    2. WorkspaceSettings (se presente)
    3. Fallback a default
    
    Esempio timezone:
    - UserPreferences.timezone → WorkspaceSettings.timezone → "UTC"
    
    Esempio locale:
    - UserPreferences.ui_locale → WorkspaceSettings.default_lang → "en-US"
    """
```

### 8.2 Uso nel Frontend

```typescript
// AppProviders.tsx
const { data: effectiveSettings } = useEffectiveSettings()

useEffect(() => {
  // Applica tema
  if (effectiveSettings?.theme === 'dark' || 
      (effectiveSettings?.theme === 'system' && prefersDark)) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  
  // Applica locale
  i18n.changeLanguage(effectiveSettings?.locale || 'en-US')
}, [effectiveSettings])
```

---

## 📝 9. Best Practices SaaS Settings

### 9.1 Patterns Comuni

1. **Hierarchical Settings**: Workspace → User (user override workspace)
2. **Defaults**: Valori di default sensati per ogni setting
3. **Validation**: Validare tutti gli input prima di salvare
4. **Partial Updates**: PATCH invece di PUT, non resettare campi non mandati
5. **Caching**: Cache settings in memoria per performance (opzionale)
6. **Versioning**: Versionare schema settings per backward compatibility

### 9.2 Separazione Compliance

**IMPORTANTE**: Non duplicare logica compliance.

- **`CountryRule`** (già esistente): Contiene regole dettagliate per paese
  - Regime B2B/B2C
  - Quiet hours per paese
  - AI disclosure requirements
  - Recording basis
  - DNC rules

- **`WorkspaceSettings.compliance`**: Contiene solo configurazione
  - `require_legal_review`: Se richiedere review legale
  - `override_country_rules_enabled`: Se permettere override regole paese
  - **NON** contiene le regole stesse

---

## 🚀 10. Piano di Implementazione

### Fase 1: Backend Foundation
1. Creare modelli `WorkspaceSettings` e `UserPreferences` (con JSONB, encryption)
2. Creare migration per nuove tabelle
3. Implementare encryption utilities per API keys
4. Migrare dati esistenti (backfill per tutti i tenant)
5. Creare servizi `get_workspace_settings()`, `get_user_preferences()`, `get_effective_settings()`
6. Aggiornare `get_settings()` per usare tenant_id (backward compatibility)

### Fase 2: API Endpoints
1. Implementare endpoint `/settings/workspace/*` (PATCH)
2. Implementare endpoint `/settings/preferences/*` (PATCH)
3. Implementare endpoint `/settings/effective` (GET)
4. Aggiungere validazione e permissions
5. Implementare encryption/decryption per API keys
6. Test API endpoints

### Fase 3: Frontend
1. Creare struttura `features/settings`
2. Implementare API client e hooks
3. Creare `SettingsPage` con layout sidebar
4. Implementare sezioni Workspace Settings (solo admin)
5. Implementare sezioni User Preferences
6. Implementare save per sezione con feedback
7. Implementare unsaved changes warning
8. Integrare `useEffectiveSettings()` in AppProviders per theme/locale
9. Aggiungere routing `/settings`

### Fase 4: Integration
1. Aggiornare tutti i riferimenti a `get_settings()`
2. Usare `get_effective_settings()` per theme/locale/date format
3. Test end-to-end
4. Deprecare vecchie tabelle (dopo periodo di backward compatibility)

---

## ❓ 11. Domande Risolte

1. ✅ **tenant_id**: Valore logico (Integer), NON FK. Utente vede sempre il suo nome.
2. ✅ **Compliance**: Non duplicare, usare `CountryRule` per regole, `WorkspaceSettings` per configurazione.
3. ✅ **PUT vs PATCH**: Usare PATCH per update parziali.
4. ✅ **Encryption**: Usare `cryptography.fernet` o `pgcrypto` per API keys.
5. ✅ **UI**: Save per sezione, non globale.
6. ✅ **Permissions**: Admin per workspace, user per preferences.
7. ✅ **Resolver**: Implementare `get_effective_settings()` per risolvere workspace + user.

---

## 📚 12. Riferimenti

- [Stripe Settings](https://stripe.com/docs/api)
- [Linear Settings](https://linear.app/docs)
- [Notion Settings](https://www.notion.so/help)
- Multi-tenant SaaS patterns
- User preferences best practices
- Encryption at rest best practices
