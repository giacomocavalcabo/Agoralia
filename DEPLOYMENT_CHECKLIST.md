# 🚀 ColdAI CRM Integrations - Deployment Checklist

## 🎯 **SPRINT 9: CRM Core Integrations + Ottimizzazioni Last-Mile**

### **✅ PRE-DEPLOYMENT COMPLETATO**

- [x] **Codice**: Sprint 9 + ottimizzazioni last-mile completato
- [x] **Test**: Funzionalità verificate localmente
- [x] **Documentazione**: Playbook incident + docs support
- [x] **Script**: Deployment Railway + Vercel + Canary testing
- [x] **Configurazioni**: railway.toml + vercel.json

---

## 🚀 **FASE 1: DEPLOYMENT RAILWAY (BACKEND)**

### **Prerequisiti**
- [ ] Railway CLI installato: `npm install -g @railway/cli`
- [ ] Account Railway configurato
- [ ] Progetto Railway creato

### **Comandi di Deploy**
```bash
# 1. Login Railway
railway login

# 2. Link progetto (se non già fatto)
railway link

# 3. Deploy automatico
./deploy_railway.sh
```

### **Verifiche Post-Deploy**
- [ ] **Build**: Nixpacks success
- [ ] **Health Check**: `/health` endpoint risponde
- [ ] **URL**: Backend accessibile su Railway
- [ ] **Logs**: Nessun errore critico

---

## 🌐 **FASE 2: DEPLOYMENT VERCEL (FRONTEND)**

### **Prerequisiti**
- [ ] Vercel CLI installato: `npm install -g vercel`
- [ ] Account Vercel configurato
- [ ] Progetto Vercel creato

### **Comandi di Deploy**
```bash
# 1. Vai alla directory frontend
cd frontend

# 2. Deploy automatico
../deploy_vercel.sh
```

### **Verifiche Post-Deploy**
- [ ] **Build**: Vite success
- [ ] **Frontend**: Accessibile su Vercel
- [ ] **API Calls**: Frontend può chiamare backend
- [ ] **CORS**: Backend accetta richieste frontend

---

## 🔧 **FASE 3: CONFIGURAZIONE ENVIRONMENT**

### **Railway Environment Variables**
```bash
# Base URLs
APP_BASE_URL=https://api.agoralia.app
FRONTEND_BASE_URL=https://app.agoralia.com

# CRM HubSpot
CRM_HUBSPOT_CLIENT_ID=your_hubspot_client_id
CRM_HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
CRM_HUBSPOT_WEBHOOK_SECRET=your_webhook_secret
CRM_HUBSPOT_REDIRECT_URI=https://api.agoralia.app/crm/hubspot/callback

# CRM Zoho
CRM_ZOHO_CLIENT_ID=your_zoho_client_id
CRM_ZOHO_CLIENT_SECRET=your_zoho_client_secret
CRM_ZOHO_WEBHOOK_SECRET=your_webhook_secret
CRM_ZOHO_DC=eu
CRM_ZOHO_REDIRECT_URI=https://api.agoralia.app/crm/zoho/callback

# CRM Odoo
ODOO_BASE_URL=https://your.odoo.tld
ODOO_DB=your_odoo_database
ODOO_CLIENT_ID=your_odoo_client_id
ODOO_CLIENT_SECRET=your_odoo_client_secret

# Retell
RETELL_API_KEY=your_retell_api_key
RETELL_WEBHOOK_SECRET=your_retell_webhook_secret

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Database & Redis
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=rediss://user:pass@host:port

# Encryption
ENCRYPTION_KEY=your_32_byte_fernet_key
```

### **Vercel Environment Variables**
```bash
# API Base URL
VITE_API_BASE_URL=https://api.agoralia.app
```

---

## 🐦 **FASE 4: CANARY TESTING**

### **Avvio Canary Testing**
```bash
# 1. Configura URLs
export BACKEND_URL="https://api.agoralia.app"
export FRONTEND_URL="https://app.agoralia.com"
export WORKSPACE_ID="ws_pilot_1"

# 2. Avvia canary testing
./canary_testing.sh
```

### **Timeline Canary (120 minuti)**
```
0-15′: OAuth + Webhooks test
15-45′: Import piccola (100 righe)
45-90′: Chiamate outbound/inbound
90-120′: Decisione finale
```

### **Success Criteria**
- [ ] **Webhook latency**: < 2s P95
- [ ] **CRM sync errors**: = 0 (5m)
- [ ] **Rate limit hits**: ≈ 0
- [ ] **DLQ size**: = 0
- [ ] **User experience**: Fluida

---

## 📊 **FASE 5: MONITORING & ALERTING**

### **Health Check Endpoints**
```bash
# Base health
curl "https://api.agoralia.app/health"

# CRM health
curl "https://api.agoralia.app/crm/health?provider=hubspot"
curl "https://api.agoralia.app/crm/health?provider=zoho"
curl "https://api.agoralia.app/crm/health?provider=odoo"

# Metrics
curl "https://api.agoralia.app/crm/metrics"
```

### **Key Metrics da Monitorare**
```yaml
# Performance
webhook_latency_seconds_p95 < 2s ✅
crm_sync_duration_seconds < 30s ✅

# Reliability
crm_sync_errors_total = 0 ✅
rate_limit_hits_total ≈ 0 ✅

# Queue Health
dlq_size = 0 ✅
worker_queue_size < 100 ✅
```

### **Alerting Thresholds**
```yaml
# Warning
crm_sync_errors_total > 0 in 5m
webhook_latency_p95 > 2s in 5m
rate_limit_hits > 10 in 1m

# Critical
connection_failures > 3 in 10m
dlq_size > 0
worker_down = true
```

---

## 🚨 **FASE 6: INCIDENT RESPONSE**

### **Emergency Procedures**
```bash
# Pausa tutti i sync
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=true"
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=zoho&pause=true"
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=odoo&pause=true"

# Check worker status
ps aux | grep dramatiq
redis-cli ping

# Review recent logs
curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_pilot_1"
```

### **Rollback Strategy**
```bash
# Database rollback
alembic downgrade -1

# Railway rollback
railway rollback

# Vercel rollback
vercel rollback
```

---

## 🎯 **FASE 7: GO-LIVE DECISION**

### **Canary Success Criteria**
```
✅ 2 ore senza errori critici
✅ Metriche entro soglie
✅ User experience fluida
✅ Team confident
```

### **Decision Matrix**
```
🎉 SUCCESS: Apri a tutti i workspace
⚠️  MINOR ISSUES: Fix e ri-test
🚨 MAJOR ISSUES: Rollback e investigazione
```

### **Post-Canary Actions**
- [ ] **Monitor**: Metriche produzione
- [ ] **Document**: Lessons learned
- [ ] **Prepare**: Sprint 10 kickoff
- [ ] **Scale**: Aumenta worker se necessario

---

## 📋 **CHECKLIST FINALE**

### **Pre-Deploy**
- [ ] Codice committato e pushato
- [ ] Test locali passati
- [ ] Railway CLI installato
- [ ] Vercel CLI installato
- [ ] Environment variables preparate

### **Deploy Backend**
- [ ] Railway deployment success
- [ ] Health checks passano
- [ ] Environment variables configurate
- [ ] Database migrazioni eseguite

### **Deploy Frontend**
- [ ] Vercel deployment success
- [ ] Frontend accessibile
- [ ] API connectivity verificata
- [ ] CORS configurato correttamente

### **Canary Testing**
- [ ] OAuth flow funziona
- [ ] Webhook replay funziona
- [ ] Metrics endpoint funziona
- [ ] Admin endpoints funzionano
- [ ] 2 ore di testing completate

### **Go-Live**
- [ ] Canary testing passed
- [ ] Team confident
- [ ] Monitoring attivo
- [ ] Rollback plan ready
- [ ] **🚀 APRI A TUTTI I WORKSPACE!**

---

## 🎉 **SUCCESS!**

**Sprint 9: CRM Core Integrations è pronto per la produzione!**

### **Funzionalità Consegnate**
- ✅ **Integrazioni CRM Complete**: HubSpot, Zoho, Odoo
- ✅ **Sincronizzazione Bidirezionale**: Webhook + Polling
- ✅ **UI Integrata**: Mapping editor + Sync status
- ✅ **Sicurezza Robusta**: OAuth + Webhook verification
- ✅ **Monitoring Completo**: Prometheus + Health checks
- ✅ **Operational Excellence**: Kill-switch + Replay + Presets

### **Business Value**
- 🎯 **Lead Management**: Sincronizzazione automatica con CRM
- 🎯 **Call Intelligence**: Push risultati chiamate per qualificazione
- 🎯 **Data Consistency**: Sincronizzazione bidirezionale real-time
- 🎯 **Multi-Provider**: Supporto per i principali CRM del mercato

---

**Status: 🟢 READY FOR PRODUCTION DEPLOYMENT** 🚀

**Team**: CRM Integration Team  
**Version**: Sprint 9  
**Date**: January 2025
