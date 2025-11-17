# Settings Implementation - Backend Foundation

## ✅ Implementato

### 1. Encryption Utilities
- `backend/utils/encryption.py`
- Usa `cryptography.fernet` per encryption at rest
- Funzioni: `encrypt_value()`, `decrypt_value()`
- Chiave da env var `ENCRYPTION_KEY` (con fallback per dev)

### 2. Modelli SQLAlchemy

#### `WorkspaceSettings` (`backend/models/workspace_settings.py`)
- Vincoli: `UniqueConstraint("tenant_id")`
- Indici: `Index("tenant_id")`
- Campi: operative, budget, quiet hours, compliance config, language, branding, integrations (encrypted)
- `tenant_id` è valore logico (Integer), non FK

#### `UserPreferences` (`backend/models/user_preferences.py`)
- Vincoli: `UniqueConstraint("user_id")`
- Indici: `Index("user_id")`, `Index("tenant_id")`
- Campi: UI/UX, notifications, dashboard, table preferences, date/time
- Filtra sempre per `(user_id, tenant_id)` insieme per isolamento

### 3. Schema Pydantic (`backend/schemas/settings.py`)
- `WorkspaceGeneralUpdate`: Validazione hex color (#RRGGBB)
- `WorkspaceGeneralResponse`
- `WorkspaceIntegrationsResponse`: Solo `retell_api_key_set: bool`, mai il valore
- `WorkspaceIntegrationsUpdate`
- `UserPreferencesUIUpdate`: Validazione pattern (theme, date_format, time_format)
- `UserPreferencesUIResponse`
- `EffectiveSettings`: Resolver workspace + user

### 4. Servizi (Race-Safe)

#### `services/workspace_settings.py`
- `get_workspace_settings()`: Race-safe creation con `IntegrityError` handling
- `update_workspace_settings()`: Partial update, encryption automatica per API keys
- `get_retell_api_key_set()`: Check senza decrypt
- `decrypt_retell_api_key()`: Per uso interno solo

#### `services/user_preferences.py`
- `get_user_preferences()`: Race-safe, filtra sempre `(user_id, tenant_id)`
- `update_user_preferences()`: Partial update

#### `services/effective_settings.py`
- `get_effective_settings()`: Resolver con priorità User → Workspace → Default

### 5. API Endpoints (`routes/workspace_settings.py`)

#### `GET /settings/workspace/general`
- Admin only (403 se non admin)
- Ritorna: workspace_name, timezone, brand_logo_url, brand_color

#### `PATCH /settings/workspace/general`
- Admin only
- Partial update (solo campi mandati)
- Validazione hex color

#### `GET /settings/workspace/integrations`
- Admin only
- Ritorna solo `retell_api_key_set: bool`, `retell_webhook_secret_set: bool`
- **Mai** ritorna i valori

#### `PATCH /settings/workspace/integrations`
- Admin only
- Keys vengono encryptate automaticamente prima di salvare

### 6. Dependency `require_admin()`
- Estrae `user_id` e `tenant_id` dal JWT
- Verifica `is_admin`
- 401 se non autenticato
- 403 se non admin

## 🔧 Caratteristiche Implementate

✅ **Vincoli e indici espliciti**
✅ **Race-safe creation** (IntegrityError handling)
✅ **Encryption at rest** per API keys
✅ **Mai ritornare keys in chiaro** (solo boolean)
✅ **PATCH per partial updates**
✅ **Validazione Pydantic** (hex color, patterns)
✅ **Permissions** (403 per non-admin)
✅ **Isolamento multi-tenant** (sempre filtra per tenant_id)

## 📝 Prossimi Passi

1. **Migration**: Creare migration per tabelle `workspace_settings` e `user_preferences`
2. **Backfill**: Migrare dati da `settings` + `app_meta` a `workspace_settings`
3. **Frontend**: Implementare `SettingsPage` con sezione General
4. **Altri endpoint**: Telephony, Budget, Compliance, Quiet Hours
5. **User Preferences**: Endpoint e UI per preferenze utente

## 🧪 Test

Per testare:
```bash
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Set encryption key (dev)
export ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# 3. Test endpoint
curl -X GET http://localhost:8000/settings/workspace/general \
  -H "Authorization: Bearer <admin_token>"
```

