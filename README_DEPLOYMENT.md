# 🚀 ColdAI CRM Integrations - Deployment Guide

## 🎯 **SPRINT 9: CRM Core Integrations + Ottimizzazioni Last-Mile**

### **📋 OVERVIEW**

Questo progetto implementa **integrazioni CRM end-to-end** per HubSpot, Zoho CRM e Odoo, con sincronizzazione bidirezionale, webhook real-time, e UI integrata per la gestione delle integrazioni.

---

## 🏗️ **ARCHITECTURE**

### **Backend (Railway)**
- **Framework**: FastAPI + SQLAlchemy + PostgreSQL
- **Background Jobs**: Dramatiq + Redis
- **CRM Clients**: HubSpot, Zoho, Odoo
- **Security**: OAuth + Webhook verification + Rate limiting
- **Monitoring**: Prometheus metrics + Health checks

### **Frontend (Vercel)**
- **Framework**: React + Vite + Tailwind CSS
- **State Management**: React Query + Zustand
- **CRM Integration**: Mapping editor + Sync status + Push buttons

### **Database**
- **Primary**: PostgreSQL (Railway)
- **Cache**: Redis (Railway)
- **Migrations**: Alembic

---

## 🚀 **QUICK START DEPLOYMENT**

### **1. ONE-COMMAND DEPLOYMENT**

```bash
# 🚀 Deploy tutto con un comando!
./DEPLOY_NOW.sh
```

Questo script:
- ✅ Verifica prerequisiti
- 🚀 Deploy backend su Railway
- 🌐 Deploy frontend su Vercel
- 🔧 Configura environment variables
- 🐦 Avvia canary testing
- 📊 Verifica deployment

### **2. MANUAL DEPLOYMENT**

```bash
# Backend (Railway)
./deploy_railway.sh

# Frontend (Vercel)
cd frontend && ../deploy_vercel.sh

# Canary Testing
./canary_testing.sh
```

---

## 📋 **PREREQUISITI**

### **CLI Tools**
```bash
# Railway CLI
npm install -g @railway/cli

# Vercel CLI
npm install -g vercel

# Utility tools
brew install jq curl  # macOS
# apt install jq curl  # Ubuntu
```

### **Accounts & Projects**
- ✅ **Railway Account**: Per backend + database + Redis
- ✅ **Vercel Account**: Per frontend
- ✅ **Railway Project**: Backend service configurato
- ✅ **Vercel Project**: Frontend service configurato

---

## 🔧 **CONFIGURAZIONE ENVIRONMENT**

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

## 🐦 **CANARY TESTING**

### **Timeline (120 minuti)**

```
0-15′: OAuth + Webhooks test
15-45′: Import piccola (100 righe)
45-90′: Chiamate outbound/inbound
90-120′: Decisione finale
```

### **Success Criteria**

- ✅ **Webhook latency**: < 2s P95
- ✅ **CRM sync errors**: = 0 (5m)
- ✅ **Rate limit hits**: ≈ 0
- ✅ **DLQ size**: = 0
- ✅ **User experience**: Fluida

### **Avvio Canary Testing**

```bash
# Configura URLs
export BACKEND_URL="https://api.agoralia.app"
export FRONTEND_URL="https://app.agoralia.com"
export WORKSPACE_ID="ws_pilot_1"

# Avvia canary testing
./canary_testing.sh
```

---

## 📊 **MONITORING & HEALTH CHECKS**

### **Health Endpoints**

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

### **Key Metrics**

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

---

## 🚨 **INCIDENT RESPONSE**

### **Emergency Procedures**

```bash
# 🛑 Pausa tutti i CRM sync
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=true"
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=zoho&pause=true"
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=odoo&pause=true"

# 🔍 Check worker status
ps aux | grep dramatiq
redis-cli ping

# 📊 Check metrics
curl "https://api.agoralia.app/crm/metrics"
```

### **Rollback Strategies**

```bash
# Railway rollback (Backend)
railway rollback

# Vercel rollback (Frontend)
vercel rollback

# Database rollback
alembic downgrade -1
```

### **Documentazione Completa**

- 📚 **Rollback Runbook**: `ROLLBACK_RUNBOOK.md`
- 📋 **Deployment Checklist**: `DEPLOYMENT_CHECKLIST.md`
- 🐦 **Canary Testing**: `canary_testing.sh`

---

## 🎯 **FEATURES IMPLEMENTATE**

### **✅ CRM Integrations**
- **HubSpot**: OAuth + Webhooks + Field mapping
- **Zoho CRM**: OAuth + Webhooks + Field mapping
- **Odoo**: API Key + Polling + Field mapping

### **✅ Core Functionality**
- **Bidirectional Sync**: Pull + Push + Backfill
- **Field Mapping**: Custom mappings + Transformations + Picklists
- **Webhook Processing**: Real-time + Idempotency + Conflict resolution
- **Rate Limiting**: Token bucket + Exponential backoff

### **✅ UI Components**
- **Integrations Page**: Connect/Disconnect + Status + Scopes
- **Mapping Editor**: Contact/Company/Deal field mapping
- **Sync Status**: Real-time sync status + Logs + Metrics
- **Push Buttons**: Call outcome push to CRM

### **✅ Operational Excellence**
- **Monitoring**: Prometheus metrics + Health checks
- **Alerting**: Threshold-based alerting system
- **Kill-switch**: Pause all sync operations
- **Webhook Replay**: Re-process failed webhooks
- **Mapping Presets**: Default mappings per provider

---

## 🔍 **TROUBLESHOOTING**

### **Common Issues**

#### **1. Railway Build Failures**
```bash
# Check build logs
railway logs

# Verify railway.toml
cat railway.toml

# Check environment variables
railway variables
```

#### **2. Vercel Build Failures**
```bash
# Check build logs
vercel logs

# Verify vercel.json
cat vercel.json

# Check environment variables
vercel env ls
```

#### **3. CRM Connection Issues**
```bash
# Test OAuth endpoints
curl "https://api.agoralia.app/crm/hubspot/start?workspace_id=ws_pilot_1"

# Check CRM health
curl "https://api.agoralia.app/crm/health?provider=hubspot"

# Verify environment variables
railway variables | grep CRM
```

#### **4. Database Issues**
```bash
# Check database connection
curl "https://api.agoralia.app/health"

# Verify DATABASE_URL
railway variables | grep DATABASE_URL

# Check migration status
# (se hai accesso diretto al database)
alembic current
```

---

## 📚 **DOCUMENTATION**

### **Core Files**
- 📋 **`DEPLOYMENT_CHECKLIST.md`**: Checklist completo per deployment
- 🚨 **`ROLLBACK_RUNBOOK.md`**: Procedure di rollback e incident response
- 🐦 **`canary_testing.sh`**: Script di canary testing
- 🚀 **`deploy_railway.sh`**: Script deployment Railway
- 🌐 **`deploy_vercel.sh`**: Script deployment Vercel
- 🎯 **`DEPLOY_NOW.sh`**: Script principale per deployment completo

### **Configuration Files**
- ⚙️ **`railway.toml`**: Configurazione Railway
- 🌐 **`vercel.json`**: Configurazione Vercel
- 🔧 **`backend/env_template.txt`**: Template environment variables

---

## 🎉 **SUCCESS METRICS**

### **Deployment Success**
- ✅ **Backend**: Deployed su Railway, health checks passano
- ✅ **Frontend**: Deployed su Vercel, accessibile e funzionale
- ✅ **Database**: Migrazioni eseguite, tabelle CRM create
- ✅ **CRM Integrations**: OAuth funziona, webhook configurati

### **Canary Testing Success**
- ✅ **2 ore** senza errori critici
- ✅ **Metriche** entro soglie definite
- ✅ **User experience** fluida e responsive
- ✅ **Team confident** per go-live

### **Go-Live Criteria**
- 🎯 **Canary testing passed** (2 ore)
- 🎯 **All health checks green**
- 🎯 **Metrics within thresholds**
- 🎯 **No critical incidents**
- 🎯 **Team approval**

---

## 🚀 **NEXT STEPS**

### **Post-Deployment**
1. **Monitor**: Metriche produzione + Health checks
2. **Scale**: Aumenta worker se necessario
3. **Document**: Lessons learned + Best practices
4. **Prepare**: Sprint 10 kickoff

### **Future Enhancements**
- 🔄 **Real-time sync**: WebSocket per UI updates
- 📱 **Mobile app**: React Native per mobile
- 🤖 **AI-powered**: Machine learning per lead scoring
- 🌍 **Multi-language**: Supporto per più lingue
- 📊 **Advanced analytics**: Dashboard executive

---

## 📞 **SUPPORT & CONTACT**

### **Team Contacts**
- 🚨 **Emergency**: #incidents Slack channel
- 📧 **Engineering**: engineering@agoralia.com
- 📱 **On-Call**: +1-XXX-XXX-XXXX

### **Documentation**
- 📚 **Technical Docs**: Questo repository
- 🎯 **User Guide**: Frontend help system
- 🚨 **Incident Playbook**: `ROLLBACK_RUNBOOK.md`

---

**Status: 🟢 READY FOR PRODUCTION DEPLOYMENT** 🚀

**Team**: CRM Integration Team  
**Version**: Sprint 9  
**Date**: January 2025  
**Deployment**: Canary Strategy
