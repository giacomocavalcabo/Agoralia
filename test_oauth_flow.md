# Test OAuth Flow - HubSpot Integration

## Modifiche Implementate

### 1. Frontend (`Integrations.jsx`)
- ✅ **URL Parameter Consumption**: Consuma `?hubspot=connected` una sola volta
- ✅ **Force Refetch**: Forza il refetch dello status dopo OAuth success
- ✅ **Clean URL**: Pulisce l'URL per evitare re-triggering
- ✅ **Workspace ID**: Passa sempre `workspace_id` nelle chiamate API

### 2. Backend (`crm.py`)
- ✅ **JWT State Management**: Sostituisce session-based state con JWT
- ✅ **Unified Database**: Usa `ProviderAccount` come single source of truth
- ✅ **Better Error Handling**: Gestione errori migliorata con logging
- ✅ **Metadata Tracking**: Salva portal_id e timestamp di connessione

## Test Steps

### 1. Test OAuth Start
```bash
curl -i "https://app.agoralia.app/api/crm/hubspot/start?workspace_id=ws_1" \
  -H "Cookie: <session_cookie>"
```

**Expected**: 
- Status 200
- `auth_url` con JWT state
- `state_length` nel debug

### 2. Test Integration Status
```bash
curl -i "https://app.agoralia.app/api/integrations/status?workspace_id=ws_1" \
  -H "Cookie: <session_cookie>"
```

**Expected**:
- Status 200
- `hubspot.connected: false` (prima della connessione)
- `hubspot.connected: true` (dopo OAuth success)

### 3. Test OAuth Callback (Simulato)
Dopo aver completato OAuth su HubSpot, il callback dovrebbe:
- Validare JWT state
- Salvare tokens in `ProviderAccount`
- Redirectare a `?hubspot=connected`

### 4. Test Frontend Behavior
1. Clicca "Connect" su HubSpot
2. Completa OAuth su HubSpot
3. Verifica che il frontend:
   - Mostri toast "HubSpot Connected"
   - Aggiorni status a "Connected"
   - Pulisci URL (rimuova `?hubspot=connected`)

## Debugging

### Logs da controllare:
- `[Integrations] Processing HubSpot OAuth flag: connected`
- `[Integrations] Refetching integration status...`
- `[Integrations] Status refetched: {hubspot: {connected: true}}`

### Database da controllare:
```sql
SELECT * FROM provider_accounts 
WHERE provider = 'hubspot' 
AND workspace_id = 'ws_1';
```

## Problemi Risolti

1. **Race Condition**: URL parameter consumption ora è atomico
2. **Session Dependency**: JWT state elimina dipendenza da session
3. **Database Mismatch**: Single source of truth con `ProviderAccount`
4. **Workspace ID**: Sempre passato correttamente
5. **URL Cleanup**: Previene re-triggering accidentale

## Next Steps

1. Testare il flusso completo end-to-end
2. Verificare che lo status si aggiorni correttamente
3. Testare disconnessione e riconnessione
4. Verificare che i lead si possano importare
