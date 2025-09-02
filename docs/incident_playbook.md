# CRM Incident Response Playbook

## 🚨 Emergency Response Procedures

### **SEV-1: Critical - All CRM Sync Down**
**Impact**: No data synchronization, potential data loss
**Response Time**: 15 minutes

#### Immediate Actions
1. **Pause all sync operations**
   ```bash
   # Pause HubSpot
   curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=true"
   
   # Pause Zoho
   curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=zoho&pause=true"
   
   # Pause Odoo
   curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=odoo&pause=true"
   ```

2. **Check worker status**
   ```bash
   # Verify Dramatiq worker is running
   ps aux | grep dramatiq
   
   # Check Redis connection
   redis-cli ping
   ```

3. **Review recent logs**
   ```bash
   # Get last 50 sync logs
   curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_1"
   ```

#### Escalation
- **15min**: Notify team lead
- **30min**: Notify product manager
- **1hr**: Notify stakeholders

---

### **SEV-2: High - Single Provider Down**
**Impact**: One CRM provider not syncing
**Response Time**: 30 minutes

#### Immediate Actions
1. **Check provider health**
   ```bash
   # Test specific provider
   curl "https://api.agoralia.app/crm/health?provider=hubspot"
   ```

2. **Review provider-specific logs**
   ```bash
   # Get logs for specific provider
   curl "https://api.agoralia.app/crm/sync/logs?provider=hubspot&limit=20"
   ```

3. **Check webhook status**
   ```bash
   # Verify webhook events
   curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_1"
   ```

#### Common Fixes
- **OAuth expired**: Re-authenticate user
- **Rate limit hit**: Wait for reset, check thresholds
- **Webhook failure**: Verify signature, check secrets

---

### **SEV-3: Medium - Performance Degradation**
**Impact**: Slow sync, high latency
**Response Time**: 1 hour

#### Immediate Actions
1. **Check metrics**
   ```bash
   # Get performance metrics
   curl "https://api.agoralia.app/crm/metrics"
   ```

2. **Review rate limiting**
   ```bash
   # Check rate limit hits
   # Look for crm_rate_limit_hits_total in Prometheus
   ```

3. **Analyze sync duration**
   ```bash
   # Check crm_sync_duration_seconds histogram
   # Look for P95 > 2s
   ```

#### Performance Tuning
- **Reduce sync frequency**: Increase polling intervals
- **Optimize batch size**: Reduce page size in config
- **Scale workers**: Increase Dramatiq worker count

---

## 🔧 Diagnostic Commands

### **Health Check Matrix**
```bash
# Test all providers
for provider in hubspot zoho odoo; do
  echo "Testing $provider..."
  curl -s "https://api.agoralia.app/crm/health?provider=$provider" | jq '.status'
done
```

### **Sync Status Overview**
```bash
# Get comprehensive status
curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_1" | jq '.connections[] | {provider, status, sync_enabled, kill_switch}'
```

### **Recent Activity**
```bash
# Get last 20 sync operations
curl "https://api.agoralia.app/crm/sync/logs?provider=hubspot&limit=20" | jq '.[] | {timestamp, level, message}'
```

### **Webhook Events**
```bash
# Check webhook processing
curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_1" | jq '.webhook_events[] | {provider, status, received_at}'
```

## 🚦 Recovery Procedures

### **Restart Worker**
```bash
# Stop Dramatiq worker
pkill -f "dramatiq backend.workers.crm_jobs"

# Start with increased workers
dramatiq backend.workers.crm_jobs -p 8
```

### **Clear Failed Jobs**
```bash
# Check Redis for failed jobs
redis-cli llen "dramatiq:failed"

# Clear failed queue if needed
redis-cli del "dramatiq:failed"
```

### **Reset Sync Cursors**
```bash
# This requires database access
# Reset to 24 hours ago for specific provider/object
UPDATE crm_sync_cursors 
SET since_ts = NOW() - INTERVAL '24 hours' 
WHERE provider = 'hubspot' AND object = 'contact';
```

### **Replay Failed Webhooks**
```bash
# Replay specific failed event
curl -X POST "https://api.agoralia.app/crm/admin/replay-webhook?provider=hubspot&event_id=event_123"
```

## 📊 Monitoring & Alerting

### **Key Metrics to Watch**
- **`crm_sync_errors_total`**: Should be 0
- **`crm_webhook_latency_seconds_p95`**: Should be <2s
- **`crm_rate_limit_hits_total`**: Should be <10/min
- **`crm_connection_status`**: Should be 1 (connected)

### **Alert Thresholds**
```yaml
crm_sync_errors_total > 0 in 5m → Warning
webhook_latency_p95 > 2s in 5m → Warning
rate_limit_hits > 10 in 1m → Warning
connection_failures > 3 in 10m → Critical
```

### **Dashboard Queries**
```promql
# Sync error rate
rate(crm_sync_errors_total[5m])

# Webhook latency P95
histogram_quantile(0.95, rate(crm_sync_duration_seconds_bucket[5m]))

# Rate limit hits
rate(crm_rate_limit_hits_total[1m])
```

## 🚨 Communication Plan

### **Internal Notifications**
- **Slack**: #crm-alerts channel
- **Email**: tech-team@agoralia.com
- **PagerDuty**: CRM Integration team

### **External Communications**
- **Status Page**: Update agoralia.statuspage.io
- **Customer Support**: Notify support team
- **Stakeholders**: Product manager notification

### **Post-Incident**
1. **Incident Report**: Document within 24 hours
2. **Root Cause Analysis**: Complete within 48 hours
3. **Action Items**: Assign and track improvements
4. **Lessons Learned**: Share with team

---

## 📋 Incident Checklist

### **During Incident**
- [ ] Pause affected sync operations
- [ ] Assess impact scope
- [ ] Execute diagnostic commands
- [ ] Apply immediate fixes
- [ ] Monitor recovery
- [ ] Communicate status

### **Post-Incident**
- [ ] Resume normal operations
- [ ] Document incident details
- [ ] Update runbooks
- [ ] Schedule retrospective
- [ ] Implement preventive measures

---

**Last Updated**: January 2025  
**Version**: Sprint 9 CRM Integrations  
**Owner**: CRM Integration Team
