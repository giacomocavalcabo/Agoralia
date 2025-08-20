"""
Alerting system for CRM operations based on Prometheus metrics
"""
import asyncio
import logging
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
from prometheus_client import Counter, Histogram, Gauge

logger = logging.getLogger(__name__)

# Alert thresholds
ALERT_THRESHOLDS = {
    "crm_sync_errors": {
        "threshold": 0,
        "window": "5m",
        "description": "CRM sync errors detected"
    },
    "webhook_latency": {
        "threshold": 2.0,  # seconds
        "window": "5m",
        "description": "Webhook latency exceeded threshold"
    },
    "rate_limit_hits": {
        "threshold": 10,
        "window": "1m",
        "description": "Rate limit hits exceeded threshold"
    },
    "connection_failures": {
        "threshold": 3,
        "window": "10m",
        "description": "CRM connection failures detected"
    }
}

# Alert handlers
ALERT_HANDLERS: Dict[str, List[Callable]] = {
    "crm_sync_errors": [],
    "webhook_latency": [],
    "rate_limit_hits": [],
    "connection_failures": []
}


class CRMAlerting:
    """CRM alerting system based on Prometheus metrics"""
    
    def __init__(self):
        self.alerts_sent = Counter(
            'crm_alerts_sent_total',
            'Total number of CRM alerts sent',
            ['alert_type', 'severity']
        )
        self.alert_state = Gauge(
            'crm_alert_state',
            'Current alert state (0=ok, 1=warning, 2=critical)',
            ['alert_type']
        )
    
    def register_handler(self, alert_type: str, handler: Callable):
        """Register an alert handler"""
        if alert_type not in ALERT_HANDLERS:
            ALERT_HANDLERS[alert_type] = []
        ALERT_HANDLERS[alert_type].append(handler)
        logger.info(f"Registered handler for {alert_type} alerts")
    
    async def check_crm_sync_errors(self, provider: str, error_count: int):
        """Check for CRM sync errors and trigger alerts"""
        if error_count > ALERT_THRESHOLDS["crm_sync_errors"]["threshold"]:
            await self._trigger_alert(
                "crm_sync_errors",
                "warning",
                f"CRM sync errors detected for {provider}: {error_count} errors",
                {
                    "provider": provider,
                    "error_count": error_count,
                    "threshold": ALERT_THRESHOLDS["crm_sync_errors"]["threshold"]
                }
            )
    
    async def check_webhook_latency(self, provider: str, latency_p95: float):
        """Check webhook latency and trigger alerts"""
        if latency_p95 > ALERT_THRESHOLDS["webhook_latency"]["threshold"]:
            await self._trigger_alert(
                "webhook_latency",
                "warning",
                f"Webhook latency exceeded threshold for {provider}: {latency_p95:.2f}s",
                {
                    "provider": provider,
                    "latency_p95": latency_p95,
                    "threshold": ALERT_THRESHOLDS["webhook_latency"]["threshold"]
                }
            )
    
    async def check_rate_limit_hits(self, provider: str, hit_count: int):
        """Check rate limit hits and trigger alerts"""
        if hit_count > ALERT_THRESHOLDS["rate_limit_hits"]["threshold"]:
            await self._trigger_alert(
                "rate_limit_hits",
                "warning",
                f"Rate limit hits exceeded for {provider}: {hit_count} hits",
                {
                    "provider": provider,
                    "hit_count": hit_count,
                    "threshold": ALERT_THRESHOLDS["rate_limit_hits"]["threshold"]
                }
            )
    
    async def check_connection_failures(self, provider: str, failure_count: int):
        """Check connection failures and trigger alerts"""
        if failure_count > ALERT_THRESHOLDS["connection_failures"]["threshold"]:
            await self._trigger_alert(
                "connection_failures",
                "critical",
                f"CRM connection failures for {provider}: {failure_count} failures",
                {
                    "provider": provider,
                    "failure_count": failure_count,
                    "threshold": ALERT_THRESHOLDS["connection_failures"]["threshold"]
                }
            )
    
    async def _trigger_alert(self, alert_type: str, severity: str, message: str, context: Dict):
        """Trigger an alert and notify all handlers"""
        try:
            # Update alert state
            severity_value = {"info": 0, "warning": 1, "critical": 2}.get(severity, 0)
            self.alert_state.labels(alert_type=alert_type).set(severity_value)
            
            # Increment alert counter
            self.alerts_sent.labels(alert_type=alert_type, severity=severity).inc()
            
            # Create alert payload
            alert = {
                "type": alert_type,
                "severity": severity,
                "message": message,
                "context": context,
                "timestamp": datetime.utcnow().isoformat(),
                "threshold": ALERT_THRESHOLDS[alert_type]
            }
            
            # Notify all handlers
            handlers = ALERT_HANDLERS.get(alert_type, [])
            for handler in handlers:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(alert)
                    else:
                        handler(alert)
                except Exception as e:
                    logger.error(f"Alert handler failed: {e}")
            
            logger.warning(f"Alert triggered: {alert_type} - {severity} - {message}")
            
        except Exception as e:
            logger.error(f"Failed to trigger alert: {e}")
    
    async def clear_alert(self, alert_type: str):
        """Clear an alert state"""
        try:
            self.alert_state.labels(alert_type=alert_type).set(0)
            logger.info(f"Alert cleared: {alert_type}")
        except Exception as e:
            logger.error(f"Failed to clear alert: {e}")


# Default alert handlers
async def log_alert_handler(alert: Dict):
    """Default handler that logs alerts"""
    logger.warning(f"ALERT [{alert['severity'].upper()}] {alert['type']}: {alert['message']}")


async def slack_alert_handler(alert: Dict):
    """Handler that sends alerts to Slack (placeholder)"""
    # In production, implement Slack webhook integration
    logger.info(f"Slack alert: {alert['message']}")


async def email_alert_handler(alert: Dict):
    """Handler that sends alerts via email (placeholder)"""
    # In production, implement email notification
    logger.info(f"Email alert: {alert['message']}")


# Initialize alerting system
crm_alerting = CRMAlerting()

# Register default handlers
crm_alerting.register_handler("crm_sync_errors", log_alert_handler)
crm_alerting.register_handler("webhook_latency", log_alert_handler)
crm_alerting.register_handler("rate_limit_hits", log_alert_handler)
crm_alerting.register_handler("connection_failures", log_alert_handler)

# Register external handlers (uncomment in production)
# crm_alerting.register_handler("crm_sync_errors", slack_alert_handler)
# crm_alerting.register_handler("connection_failures", email_alert_handler)
