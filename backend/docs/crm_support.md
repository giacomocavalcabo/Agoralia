# CRM Support Documentation

## 🚀 Quick Start Commands

### Test Connection
```bash
# Test HubSpot connection
curl "https://api.agoralia.app/crm/health?provider=hubspot"

# Test Zoho connection  
curl "https://api.agoralia.app/crm/health?provider=zoho"

# Test Odoo connection
curl "https://api.agoralia.app/crm/health?provider=odoo"
```

### Force Pull
```bash
# Force pull contacts from HubSpot
curl -X POST "https://api.agoralia.app/crm/sync/start" \
  -H "Content-Type: application/json" \
  -d '{"provider": "hubspot", "mode": "pull", "objects": ["contact"], "backfill": true}'

# Force pull companies from Zoho
curl -X POST "https://api.agoralia.app/crm/sync/start" \
  -H "Content-Type: application/json" \
  -d '{"provider": "zoho", "mode": "pull", "objects": ["company"], "backfill": true}'
```

### View Last Events
```bash
# Get recent sync logs
curl "https://api.agoralia.app/crm/sync/logs?provider=hubspot&limit=20"

# Get webhook events
curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_1"
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Connection Failed
**Symptoms**: Health check returns "unhealthy"
**Solutions**:
- Verify environment variables are set
- Check OAuth credentials in CRM provider
- Verify redirect URIs match exactly

#### 2. Webhook Not Receiving
**Symptoms**: No webhook events in logs
**Solutions**:
- Verify webhook URL in CRM provider
- Check webhook secret matches
- Verify firewall/network access

#### 3. Sync Stuck
**Symptoms**: Sync status shows "running" indefinitely
**Solutions**:
- Check worker Dramatiq is running
- Review recent sync logs for errors
- Use admin pause/resume if needed

### Admin Commands

#### Pause/Resume Sync
```bash
# Pause HubSpot sync
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=true"

# Resume HubSpot sync
curl -X POST "https://api.agoralia.app/crm/admin/pause-sync?provider=hubspot&pause=false"
```

#### Replay Webhook
```bash
# Replay failed webhook event
curl -X POST "https://api.agoralia.app/crm/admin/replay-webhook?provider=hubspot&event_id=event_123"
```

#### Get Detailed Status
```bash
# Get comprehensive sync status
curl "https://api.agoralia.app/crm/admin/sync-status?workspace_id=ws_1"
```

## 📊 Monitoring

### Key Metrics
- **`crm_requests_total`**: Total API requests by provider
- **`crm_errors_total`**: Error count by type and provider
- **`crm_sync_duration_seconds`**: Sync operation duration
- **`crm_entities_synced_total`**: Entities synced by direction

### Alert Thresholds
- **Sync Errors**: >0 in 5m → Warning
- **Webhook Latency**: >2s P95 → Warning  
- **Rate Limit Hits**: >10 in 1m → Warning
- **Connection Failures**: >3 in 10m → Critical

### Health Check Endpoints
- **HubSpot**: `/crm/health?provider=hubspot`
- **Zoho**: `/crm/health?provider=zoho`
- **Odoo**: `/crm/health?provider=odoo`

## 🛠️ Development

### Local Testing
```bash
cd backend
python test_crm_integrations.py
```

**Note**: Local tests will fail due to relative imports - this is normal for Railway deployment.

### Adding New Provider
1. Create client in `integrations/`
2. Add to `CrmProvider` enum
3. Update `CrmSyncService.clients`
4. Add OAuth routes if needed
5. Update field mapping presets

### Field Mapping
- **Contact**: Basic info (name, email, phone)
- **Company**: Organization details (name, industry, size)
- **Deal**: Sales opportunities (amount, stage, close date)

## 📞 Support Contacts

### Technical Issues
- Check logs in Railway dashboard
- Review Prometheus metrics
- Use admin endpoints for diagnostics

### CRM Provider Issues
- **HubSpot**: Verify OAuth app configuration
- **Zoho**: Check datacenter region (EU/US/IN)
- **Odoo**: Verify API key and database access

### Emergency Procedures
1. **Pause all sync**: Use admin pause endpoints
2. **Check worker status**: Verify Dramatiq is running
3. **Review recent logs**: Look for error patterns
4. **Contact team**: Escalate if issues persist

---

**Last Updated**: January 2025
**Version**: Sprint 9 CRM Integrations
