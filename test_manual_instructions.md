# 🧪 Test Manuale - Flusso OAuth HubSpot

## Prerequisiti
- Browser con accesso a https://app.agoralia.app
- Account HubSpot con accesso a `agoralia.app` (146837718)
- Console del browser aperta per vedere i log

## Test Steps

### 1. Preparazione
1. Apri https://app.agoralia.app/settings/integrations
2. Apri la Console del browser (F12 → Console)
3. Verifica che non ci siano errori JavaScript

### 2. Test OAuth Start
1. Clicca "Connect" su HubSpot
2. **Verifica nel Network tab:**
   - Chiamata a `/api/crm/hubspot/start?workspace_id=ws_1`
   - Status 200
   - Response contiene `auth_url` con JWT state
3. **Verifica nel Console:**
   - `[Integrations] Connecting to hubspot...`
   - `[Integrations] Calling /crm/hubspot/start...`
   - `[Integrations] hubspot OAuth response: {auth_url: "...", ...}`
   - `[Integrations] Redirecting to hubspot OAuth: ...`

### 3. Test OAuth Authorization
1. Sei reindirizzato a HubSpot
2. **Scegli l'account corretto:** `agoralia.app` (146837718)
3. Clicca "Authorize" o "Allow"
4. **Verifica che l'URL di callback contenga:**
   - `code=...` (authorization code)
   - `state=...` (JWT token)

### 4. Test OAuth Callback
1. Sei reindirizzato a `https://app.agoralia.app/settings/integrations?hubspot=connected`
2. **Verifica nel Console:**
   - `[Integrations] Processing HubSpot OAuth flag: connected`
   - `[Integrations] HubSpot OAuth callback detected - connected`
   - `[Integrations] Refetching integration status...`
   - `[Integrations] Status refetched: {hubspot: {connected: true, ...}}`
3. **Verifica nel Network tab:**
   - Chiamata a `/api/integrations/status?workspace_id=ws_1`
   - Status 200
   - Response contiene `hubspot.connected: true`

### 5. Test UI Update
1. **Verifica che l'UI mostri:**
   - Toast "HubSpot Connected" (verde)
   - Status badge "Connected" (verde)
   - Pulsanti "Test" e "Disconnect" visibili
2. **Verifica che l'URL sia pulito:**
   - URL finale: `https://app.agoralia.app/settings/integrations`
   - Nessun parametro `?hubspot=connected`

### 6. Test Disconnect
1. Clicca "Disconnect"
2. **Verifica nel Console:**
   - `[Integrations] Disconnecting from hubspot...`
   - `[Integrations] hubspot disconnect response: {ok: true}`
3. **Verifica che l'UI mostri:**
   - Status badge "Disconnected" (grigio)
   - Pulsante "Connect" visibile

## Logs da Cercare

### Successo OAuth:
```
[Integrations] Processing HubSpot OAuth flag: connected
[Integrations] HubSpot OAuth callback detected - connected
[Integrations] Refetching integration status...
[Integrations] Status refetched: {hubspot: {connected: true, status: "connected"}}
```

### Errore OAuth:
```
[Integrations] Processing HubSpot OAuth flag: expired
[Integrations] HubSpot OAuth code expired
```

### Problemi da Segnalare:
- Nessun log di "Processing HubSpot OAuth flag"
- Log di "expired" invece di "connected"
- Status rimane "disconnected" dopo OAuth success
- URL non viene pulito dopo callback
- Errori JavaScript nella console

## Test di Regressione

### Test 1: Re-triggering Prevention
1. Vai su `/settings/integrations?hubspot=connected`
2. Verifica che il flag venga consumato una sola volta
3. Ricarica la pagina - non dovrebbe ri-triggerare

### Test 2: Multiple OAuth Attempts
1. Fai OAuth multiple volte
2. Verifica che ogni tentativo funzioni correttamente
3. Verifica che non ci siano conflitti

### Test 3: Error Recovery
1. Simula un errore OAuth (es. annulla su HubSpot)
2. Verifica che l'UI torni allo stato "Disconnected"
3. Verifica che si possa riprovare

## Risultati Attesi

✅ **Tutti i test dovrebbero passare**
✅ **OAuth flow completo funzionante**
✅ **UI aggiornata correttamente**
✅ **URL pulito dopo callback**
✅ **Nessun re-triggering accidentale**

## Problemi Conosciuti

- Se vedi "expired" invece di "connected", potrebbe essere un problema di scopes HubSpot
- Se lo status non si aggiorna, controlla che il backend salvi in `ProviderAccount`
- Se l'URL non viene pulito, controlla che `navigate()` venga chiamato

## Debug Avanzato

Se hai problemi, controlla:
1. **Network tab**: Tutte le chiamate API hanno status 200?
2. **Console**: Ci sono errori JavaScript?
3. **Database**: `ProviderAccount` contiene il record HubSpot?
4. **JWT State**: Il state token è valido e non scaduto?
