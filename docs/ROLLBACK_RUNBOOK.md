# 🚨 ColdAI CRM Integrations - Rollback Runbook

## 🎯 **INCIDENT RESPONSE & ROLLBACK PROCEDURES**

### **🚨 SEVERITY LEVELS**

```
🔴 CRITICAL: Sistema down, dati persi, sicurezza compromessa
🟡 HIGH: Funzionalità critiche non funzionanti, performance degradata
🟠 MEDIUM: Funzionalità secondarie non funzionanti
🟢 LOW: Bug minori, UI glitch
```

---

## 🚨 **EMERGENCY PROCEDURES (CRITICAL/HIGH)**

### **1. IMMEDIATE ACTIONS (0-5 minuti)**

```bash
# 🛑 PAUSA TUTTI I CRM SYNC
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=true"
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=zoho&pause=true"
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=odoo&pause=true"

# 🔍 CHECK WORKER STATUS
ps aux | grep dramatiq
redis-cli ping

# 📊 CHECK METRICS
curl "https://api.agoralia.app/crm/metrics"
```

### **2. ASSESSMENT (5-15 minuti)**

```bash
# 🏥 HEALTH CHECK COMPLETO
curl "https://api.agoralia.app/health"
curl "https://api.agoralia.app/crm/health?provider=hubspot"
curl "https://api.agoralia.app/crm/health?provider=zoho"
curl "https://api.agoralia.app/crm/health?provider=odoo"

# 📝 CHECK RECENT LOGS
curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_pilot_1"

# 🗄️ DATABASE STATUS
# (se hai accesso diretto)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM crm_sync_logs WHERE created_at > NOW() - INTERVAL '1 hour';"
```

---

## 🔄 **ROLLBACK STRATEGIES**

### **STRATEGY 1: RAILWAY ROLLBACK (Backend)**

```bash
# 1. Check deployment history
railway status --json

# 2. Rollback to previous version
railway rollback

# 3. Verify rollback
railway status --json

# 4. Test health endpoints
curl "https://api.agoralia.app/health"
```

### **STRATEGY 2: VERCEL ROLLBACK (Frontend)**

```bash
# 1. Check deployment history
vercel ls

# 2. Rollback to previous version
vercel rollback

# 3. Verify rollback
vercel ls
```

### **STRATEGY 3: DATABASE ROLLBACK**

```bash
# 1. Check current migration
alembic current

# 2. Rollback one migration
alembic downgrade -1

# 3. Verify rollback
alembic current
```

---

## 🎯 **SCENARI SPECIFICI**

### **SCENARIO 1: CRM SYNC ERRORS**

```bash
# 🔍 DIAGNOSI
curl "https://api.agoralia.app/crm/metrics" | jq '.metrics.failed_syncs'

# 🛑 PAUSA SYNC
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=true"

# 🔄 REPLAY WEBHOOK FAILED
curl -X POST "https://api.agoralia.app/crm/admin/replay-webhook?provider=hubspot&event_id=FAILED_EVENT_ID"

# ✅ RIPRISTINA SYNC
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=false"
```

### **SCENARIO 2: WEBHOOK LATENCY HIGH**

```bash
# 🔍 DIAGNOSI
curl "https://api.agoralia.app/crm/metrics" | jq '.metrics.webhook_latency_p95'

# 🚀 SCALE WORKERS
# Aumenta worker Dramatiq se necessario
dramatiq backend.workers.crm_jobs -p 8

# 📊 MONITOR
watch -n 5 'curl -s "https://api.agoralia.app/crm/metrics" | jq ".metrics.webhook_latency_p95"'
```

### **SCENARIO 3: DATABASE CONNECTION ISSUES**

```bash
# 🔍 DIAGNOSI
curl "https://api.agoralia.app/health"

# 🗄️ CHECK DB CONNECTION
psql $DATABASE_URL -c "SELECT 1;"

# 🔄 RESTART SERVICE
# Railway auto-restart o manual restart
railway restart

# 📊 VERIFY
curl "https://api.agoralia.app/health"
```

### **SCENARIO 4: OAUTH FLOW BROKEN**

```bash
# 🔍 DIAGNOSI
curl "https://api.agoralia.app/crm/hubspot/start?workspace_id=ws_pilot_1"

# 🔑 CHECK ENV VARS
# Verifica Railway environment variables
railway variables

# 🔄 TEST OAUTH
curl "https://api.agoralia.app/crm/hubspot/start?workspace_id=ws_pilot_1"
```

---

## 📊 **MONITORING & ALERTING**

### **KEY METRICS TO WATCH**

```yaml
# 🚨 CRITICAL THRESHOLDS
crm_sync_errors_total > 10 in 5m
webhook_latency_p95 > 5s in 5m
connection_failures > 5 in 10m
dlq_size > 0

# ⚠️ WARNING THRESHOLDS
crm_sync_errors_total > 0 in 5m
webhook_latency_p95 > 2s in 5m
rate_limit_hits > 20 in 1m
worker_queue_size > 200
```

### **ALERTING COMMANDS**

```bash
# 📊 GET CURRENT METRICS
curl -s "https://api.agoralia.app/crm/metrics" | jq '.'

# 🔍 CHECK SPECIFIC METRIC
curl -s "https://api.agoralia.app/crm/metrics" | jq '.metrics.crm_sync_errors_total'

# 📈 MONITOR IN REAL-TIME
watch -n 10 'curl -s "https://api.agoralia.app/crm/metrics" | jq ".metrics"'
```

---

## 🚀 **RECOVERY PROCEDURES**

### **POST-ROLLBACK VERIFICATION**

```bash
# 1. ✅ HEALTH CHECKS
curl "https://api.agoralia.app/health"
curl "https://api.agoralia.app/crm/health?provider=hubspot"

# 2. 🔄 TEST CRM SYNC
curl -X POST "https://api.agoralia.app/crm/sync/start" \
  -H "Content-Type: application/json" \
  -d '{"provider":"hubspot","mode":"pull","objects":["contact"],"backfill":false}'

# 3. 📊 VERIFY METRICS
curl "https://api.agoralia.app/crm/metrics"

# 4. 🧪 TEST USER FLOW
# Login → OAuth → Import → Sync → Verify
```

### **GRADUAL RE-ENABLE**

```bash
# 1. 🟢 ENABLE PILOT WORKSPACE
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=false"

# 2. 📊 MONITOR 15 MINUTI
# Verifica che tutto funzioni

# 3. 🟡 ENABLE 10% WORKSPACES
# Gradualmente riabilita

# 4. 🟢 ENABLE ALL WORKSPACES
# Solo dopo verifica completa
```

---

## 📞 **ESCALATION MATRIX**

### **ON-CALL ROTATION**

```
🕐 00:00-08:00: Primary On-Call
🕐 08:00-16:00: Secondary On-Call + Team Lead
🕐 16:00-24:00: Primary On-Call + Engineering Manager
```

### **ESCALATION TIMELINE**

```
0-15 min: On-Call Engineer
15-30 min: Team Lead
30-60 min: Engineering Manager
60+ min: CTO/VP Engineering
```

### **CONTACT INFORMATION**

```
🚨 Emergency: #incidents Slack channel
📞 On-Call: +1-XXX-XXX-XXXX
📧 Escalation: engineering-manager@agoralia.com
```

---

## 📝 **POST-INCIDENT**

### **INCIDENT REPORT TEMPLATE**

```markdown
# Incident Report: [TITLE]

## Summary
[Breve descrizione dell'incidente]

## Timeline
- **Detected**: [timestamp]
- **Escalated**: [timestamp]
- **Rollback**: [timestamp]
- **Resolved**: [timestamp]

## Root Cause
[Analisi della causa principale]

## Impact
- **Users Affected**: [numero]
- **Duration**: [durata]
- **Business Impact**: [descrizione]

## Actions Taken
1. [azione 1]
2. [azione 2]
3. [azione 3]

## Lessons Learned
- [lesson 1]
- [lesson 2]

## Follow-up Actions
- [ ] [azione 1]
- [ ] [azione 2]
- [ ] [azione 3]
```

---

## 🎯 **QUICK REFERENCE**

### **COMMANDS BY SEVERITY**

```bash
# 🚨 CRITICAL
./canary_testing.sh  # Pausa canary
railway rollback     # Rollback backend
vercel rollback      # Rollback frontend

# 🟡 HIGH
curl "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=true"
railway restart      # Restart service

# 🟠 MEDIUM
curl "https://api.agoralia.app/crm/admin/replay-webhook?provider=hubspot&event_id=EVENT_ID"
curl "https://api.agoralia.app/crm/metrics"  # Monitor

# 🟢 LOW
# Log issue, fix in next deployment
```

### **HEALTH CHECK COMMANDS**

```bash
# 🏥 COMPLETE HEALTH CHECK
curl "https://api.agoralia.app/health"
curl "https://api.agoralia.app/crm/health?provider=hubspot"
curl "https://api.agoralia.app/crm/health?provider=zoho"
curl "https://api.agoralia.app/crm/health?provider=odoo"

# 📊 METRICS DASHBOARD
curl "https://api.agoralia.app/crm/metrics" | jq '.'

# 🔍 SYNC STATUS
curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_pilot_1"
```

---

**Status: 🟢 READY FOR PRODUCTION** 🚀

**Last Updated**: January 2025  
**Version**: Sprint 9  
**Team**: CRM Integration Team
