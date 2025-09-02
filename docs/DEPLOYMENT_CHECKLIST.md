# 🚀 DEPLOYMENT CHECKLIST - SCRIPT 7 COMPLETATO ✅

## ✅ A) Login 404 + routing (definitivo) - COMPLETATO

### ✅ A1. Unifica `vercel.json` 
- [x] `vercel.json` duplicato nella root **ELIMINATO**
- [x] `frontend/vercel.json` aggiornato con SPA fallback completo
- [x] Rewrite `/(.*)` → `/index.html` per tutte le route client-side
- [x] Cache headers ottimizzati (no-store per index.html, immutable per assets)

### ✅ A2. Registra `/login` **non-lazy** 
- [x] Login importato direttamente nel router (niente lazy loading)
- [x] Niente chunk 404 per la pagina di login

### ✅ A3. Login standalone minimale 
- [x] `Login.jsx` completamente riscritta come pagina standalone
- [x] Niente dipendenze da AppShell
- [x] Design minimale e CSP-safe

### ✅ A4. i18n minimi 
- [x] Chiavi auth già presenti in EN e IT
- [x] `auth.title`, `auth.subtitle`, `auth.cta` localizzate

## ✅ B) Dashboard "puzzle" senza placeholder - COMPLETATO

### ✅ B1. Contenitore a griglia consistente 
- [x] Layout a griglia 12 colonne con `gap-6` consistente
- [x] Sezioni organizzate semanticamente con `<section>` e `<aside>`
- [x] Responsive design con breakpoint appropriati

### ✅ B2. Card generiche coerenti 
- [x] Tutte le card hanno `min-height` appropriato
- [x] Classi CSS coerenti per bordi, ombre e padding
- [x] Palette colori primaria consistente

### ✅ B3. "No placeholder" 
- [x] Empty states localizzati per tutti i widget
- [x] Niente testo statico hardcoded
- [x] Stati vuoti gestiti con i18n

### ✅ B4. Palette coerente 
- [x] Colori primari consistenti (`bg-primary-*`, `text-primary-*`)
- [x] Gradiente semantico per funnel (300→600)
- [x] Stati coerenti per warning/danger

## 🔧 Configurazione Vercel - DA VERIFICARE
- [ ] **Root Directory**: deve puntare a `frontend/` 
- [ ] **Build command**: `npm ci && npm run build`
- [ ] **Output directory**: `dist`
- [ ] **Environment variables**:
  - [ ] `VITE_API_URL=https://api.agoralia.app`
  - [ ] `VITE_AUTH_URL=https://api.agoralia.app/auth/login` (se diverso)
  - [ ] `VITE_WS_URL=wss://api.agoralia.app/ws` (se diverso)

## 🚀 Deploy Steps
1. **Commit e push** di tutte le modifiche ✅
2. **Trigger deploy** su Vercel
3. **Purge cache** dopo modifiche a `vercel.json` ✅
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
- [ ] **Realtime**: niente errori console, fallback a polling se WS off

## 📝 Note Tecniche
- **SPA fallback**: tutte le route client-side tornano `index.html` ✅
- **Layout grid**: CSS Grid con 12 colonne e `min-height` fisso ✅
- **i18n namespace**: `pages` per tutte le pagine principali ✅
- **CSP compliance**: niente inline handlers, tutti i bottoni via React onClick ✅
- **Demo mode**: gating per evitare rumore in console ✅

## 🎯 **File Modificati nello Script 7**

- ✅ `frontend/vercel.json` - SPA fallback completo
- ✅ `frontend/src/layouts/Root.jsx` - Login non-lazy
- ✅ `frontend/src/pages/Login.jsx` - Pagina standalone
- ✅ `frontend/src/pages/Dashboard.jsx` - Griglia 12 colonne + layout stabile
- ✅ `frontend/src/components/ui/GaugeBudget.jsx` - Localizzazione
- ✅ `frontend/src/locales/en-US/pages.json` - Chiavi complete
- ✅ `frontend/src/locales/it-IT/pages.json` - Chiavi complete
- ✅ `DEPLOYMENT_CHECKLIST.md` - Checklist aggiornata

---
**Ultimo aggiornamento**: $(date)
**Versione**: Script 7 — Fix definitivi ✅ COMPLETATO
**Status**: 🟢 PRONTO PER DEPLOY
