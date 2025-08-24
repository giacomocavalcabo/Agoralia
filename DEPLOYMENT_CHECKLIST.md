# 🚀 DEPLOYMENT CHECKLIST - SCRIPT 7 Hotfix Finale

## ✅ A) vercel.json — SPA fallback (fix /login 404)
- [x] `vercel.json` aggiornato con rewrites SPA
- [x] Proxy API configurato per `/api/*` → `https://api.agoralia.app/*`
- [x] Fallback `/(.*)` → `/index.html` per tutte le route client-side
- [x] Cache headers ottimizzati (no-store per index.html, immutable per assets)

## ✅ B) Routing & Login page — rotta esplicita + redirect sicuro
- [x] Rotta `/login` registrata nel router (`Root.jsx`)
- [x] Pagina `Login.jsx` semplificata e CSP-safe
- [x] Redirect automatico su 401 in `api.js`
- [x] Niente `console.log` in produzione

## ✅ C) Dashboard "puzzle" — layout a griglia stabile + stop ai placeholder
- [x] Layout a griglia 12 colonne con `min-height` fisso
- [x] Chiavi i18n aggiornate per tutti i widget:
  - [x] `dashboard.kpi.*` per le metriche KPI
  - [x] `dashboard.widgets.*` per i titoli dei widget
  - [x] `dashboard.states.*` per gli stati (not_configured, no_calls, etc.)
- [x] Niente chiavi grezze nel DOM (`dashboard.metrics.response_time` → `dashboard.widgets.sla`)
- [x] Componenti aggiornati: `GaugeBudget`, `CallsHistogram`, `ConversionFunnel`, etc.

## ✅ D) Realtime gating — niente errori WS/polling in console
- [x] Hook `useLiveWS` con gating ferreo:
  - [x] Solo se autenticato (`!!user?.id`)
  - [x] Solo se URL WS valido (`wss://`)
  - [x] Non in modalità demo
- [x] Fallback a polling sicuro con AbortController
- [x] Niente errori console per WS non configurato

## ✅ E) i18n — chiavi complete per EN e IT
- [x] `frontend/src/locales/en-US/pages.json` aggiornato
- [x] `frontend/src/locales/it-IT/pages.json` aggiornato
- [x] Chiavi auth, dashboard.kpi, dashboard.widgets, dashboard.states

## 🔧 Configurazione Vercel
- [ ] **Project root** punta a `frontend/` (se monorepo)
- [ ] **Build command**: `npm ci && npm run build`
- [ ] **Output directory**: `dist`
- [ ] **Environment variables**:
  - [ ] `VITE_API_URL=https://api.agoralia.app`
  - [ ] `VITE_AUTH_URL=https://api.agoralia.app/auth/login` (se diverso)
  - [ ] `VITE_WS_URL=wss://api.agoralia.app/ws` (se diverso)

## 🚀 Deploy Steps
1. **Commit e push** di tutte le modifiche
2. **Trigger deploy** su Vercel
3. **Purge cache** dopo modifiche a `vercel.json`
4. **Verifica**:
   - [ ] `/login` non torna 404
   - [ ] Dashboard mostra griglia stabile (12 colonne)
   - [ ] Niente chiavi grezze (`dashboard.metrics.*`)
   - [ ] Budget: "Not configured" se non configurato
   - [ ] Live calls: "No active calls" se vuoto
   - [ ] Niente errori WS in console

## 🧪 Test Post-Deploy
- [ ] **Login page**: `https://app.agoralia.app/login` → si apre correttamente
- [ ] **Redirect 401**: rotta protetta senza auth → redirect a `/login`
- [ ] **Dashboard layout**: griglia stabile, niente card ballerine
- [ ] **i18n**: tutti i titoli localizzati, niente chiavi raw
- [ **Realtime**: niente errori console, fallback a polling se WS off

## 📝 Note Tecniche
- **SPA fallback**: tutte le route client-side tornano `index.html`
- **Layout grid**: CSS Grid con 12 colonne e `min-height` fisso
- **i18n namespace**: `pages` per tutte le pagine principali
- **CSP compliance**: niente inline handlers, tutti i bottoni via React onClick
- **Demo mode**: gating per evitare rumore in console

---
**Ultimo aggiornamento**: $(date)
**Versione**: Script 7 — Hotfix Finale
**Status**: ✅ COMPLETATO
