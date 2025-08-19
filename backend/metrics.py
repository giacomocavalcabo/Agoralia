"""
Prometheus metrics for CRM operations
"""

from prometheus_client import Counter, Histogram, Gauge, Summary
import time
from functools import wraps


# CRM Operation Counters
crm_operations_total = Counter(
    'crm_operations_total',
    'Total number of CRM operations',
    ['provider', 'operation', 'status']
)

crm_sync_duration = Histogram(
    'crm_sync_duration_seconds',
    'Time spent on CRM sync operations',
    ['provider', 'entity_type'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

crm_connection_status = Gauge(
    'crm_connection_status',
    'CRM connection status (1=connected, 0=disconnected)',
    ['provider', 'workspace_id']
)

crm_rate_limit_hits = Counter(
    'crm_rate_limit_hits_total',
    'Total number of rate limit hits',
    ['provider', 'endpoint']
)

crm_errors_total = Counter(
    'crm_errors_total',
    'Total number of CRM errors',
    ['provider', 'error_type', 'operation']
)

# CRM Data Metrics
crm_entities_synced = Counter(
    'crm_entities_synced_total',
    'Total number of entities synced',
    ['provider', 'entity_type', 'direction']
)

crm_field_mappings_total = Gauge(
    'crm_field_mappings_total',
    'Total number of field mappings configured',
    ['provider', 'workspace_id']
)


def track_crm_operation(provider: str, operation: str):
    """Decorator to track CRM operations with metrics"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                crm_operations_total.labels(
                    provider=provider,
                    operation=operation,
                    status="success"
                ).inc()
                return result
            except Exception as e:
                crm_operations_total.labels(
                    provider=provider,
                    operation=operation,
                    status="error"
                ).inc()
                
                # Track specific error types
                error_type = type(e).__name__
                crm_errors_total.labels(
                    provider=provider,
                    error_type=error_type,
                    operation=operation
                ).inc()
                raise
            finally:
                duration = time.time() - start_time
                crm_sync_duration.labels(
                    provider=provider,
                    entity_type=operation
                ).observe(duration)
        
        return wrapper
    return decorator


def update_connection_status(provider: str, workspace_id: str, connected: bool):
    """Update CRM connection status metric"""
    status = 1 if connected else 0
    crm_connection_status.labels(
        provider=provider,
        workspace_id=workspace_id
    ).set(status)


def track_rate_limit(provider: str, endpoint: str):
    """Track rate limit hits"""
    crm_rate_limit_hits.labels(
        provider=provider,
        endpoint=endpoint
    ).inc()


def track_entities_synced(provider: str, entity_type: str, direction: str, count: int):
    """Track entities synced"""
    crm_entities_synced.labels(
        provider=provider,
        entity_type=entity_type,
        direction=direction
    ).inc(count)


def update_field_mappings_count(provider: str, workspace_id: str, count: int):
    """Update field mappings count"""
    crm_field_mappings_total.labels(
        provider=provider,
        workspace_id=workspace_id
    ).set(count)


# Example usage in CRM clients:
"""
from metrics import track_crm_operation

class HubSpotClient:
    @track_crm_operation("hubspot", "upsert_contact")
    async def upsert_contact(self, contact_data):
        # Implementation
        pass
"""
