# Settings System - Testing Checklist

## ✅ Test Completati

### Backend
- [x] **Sintassi Python**: Tutti i file compilano senza errori
- [x] **Imports**: Tutti gli import sono corretti e disponibili
- [x] **Linting**: Nessun errore di linting
- [x] **Build Frontend**: Build completato con successo

### Struttura
- [x] **Modelli**: `WorkspaceSettings` e `UserPreferences` creati correttamente
- [x] **Servizi**: Race-safe creation implementata
- [x] **Schema Pydantic**: Validazione implementata
- [x] **Routes**: Endpoint configurati correttamente
- [x] **Migration**: Migration creata e pronta

### Frontend
- [x] **Types**: TypeScript types definiti
- [x] **API Client**: Funzioni API implementate
- [x] **Hooks**: TanStack Query hooks implementati
- [x] **Components**: SettingsLayout e GeneralSection creati
- [x] **Routing**: Route `/settings` aggiunta
- [x] **Sidebar**: Link Settings aggiunto

## 🧪 Test da Eseguire

### 1. Backend API Tests

```bash
# 1. Avvia il backend
cd backend
uvicorn main:app --reload

# 2. Test GET /settings/workspace/general (richiede admin token)
curl -X GET http://localhost:8000/settings/workspace/general \
  -H "Authorization: Bearer <admin_token>"

# 3. Test PATCH /settings/workspace/general
curl -X PATCH http://localhost:8000/settings/workspace/general \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"workspace_name": "Test Workspace", "brand_color": "#10a37f"}'

# 4. Test GET /settings/workspace/integrations
curl -X GET http://localhost:8000/settings/workspace/integrations \
  -H "Authorization: Bearer <admin_token>"

# 5. Test 403 per non-admin
curl -X GET http://localhost:8000/settings/workspace/general \
  -H "Authorization: Bearer <non_admin_token>"
# Dovrebbe ritornare 403
```

### 2. Database Migration

```bash
# 1. Verifica che la migration sia riconosciuta
cd backend
alembic current

# 2. Esegui la migration
alembic upgrade head

# 3. Verifica che le tabelle siano create
# (controlla nel database che workspace_settings e user_preferences esistano)

# 4. Verifica che i dati siano migrati
# (controlla che i tenant esistenti abbiano workspace_settings)
```

### 3. Frontend Tests

```bash
# 1. Avvia il frontend
cd frontend
npm run dev

# 2. Test manuali:
# - Login come admin
# - Naviga a /settings
# - Verifica che la sidebar mostri "Workspace Settings" e "Preferences"
# - Clicca su "General"
# - Modifica un campo (es. workspace_name)
# - Verifica che il pulsante "Save" appaia
# - Clicca "Save"
# - Verifica toast di successo
# - Ricarica la pagina e verifica che i cambiamenti siano salvati

# 3. Test validazione:
# - Prova a inserire un colore non valido (es. "red")
# - Verifica che appaia un errore
# - Prova con un colore valido (es. "#10a37f")
# - Verifica che funzioni

# 4. Test permessi:
# - Login come utente non-admin
# - Naviga a /settings
# - Verifica che "Workspace Settings" sia disabilitato/nascosto
# - Verifica che "Preferences" sia accessibile
```

### 4. Integration Tests

- [ ] **Encryption**: Verifica che le API keys siano encryptate nel DB
- [ ] **Race Conditions**: Test con richieste simultanee per creare settings
- [ ] **Multi-tenant**: Verifica isolamento tra tenant diversi
- [ ] **Effective Settings**: Test resolver workspace + user override

## 🐛 Problemi Noti

Nessuno al momento.

## 📝 Note

- La migration migra automaticamente i dati da `settings` + `app_meta` a `workspace_settings`
- I `user_preferences` vengono creati lazy (alla prima chiamata)
- Le API keys sono encryptate at rest e mai ritornate in chiaro

