"""
CRM Configuration - Rate limiting, retry policies, and provider settings
"""
import os
from typing import Dict, Any

# Rate limiting configuration
CRM_RATE_LIMITS = {
    "hubspot": {
        "requests_per_second": 5,
        "burst_limit": 10,
        "retry_attempts": 3,
        "backoff_base": 2.0,  # Exponential backoff base
        "max_backoff": 300,    # Max backoff in seconds
    },
    "zoho": {
        "requests_per_second": 3,
        "burst_limit": 8,
        "retry_attempts": 3,
        "backoff_base": 2.0,
        "max_backoff": 300,
    },
    "odoo": {
        "requests_per_second": 2,
        "burst_limit": 5,
        "retry_attempts": 3,
        "backoff_base": 2.0,
        "max_backoff": 300,
    }
}

# Sync configuration
CRM_SYNC_CONFIG = {
    "page_size": int(os.getenv("CRM_SYNC_PAGE_SIZE", "200")),
    "max_concurrent_syncs": int(os.getenv("CRM_MAX_CONCURRENT_SYNCS", "3")),
    "sync_timeout": int(os.getenv("CRM_SYNC_TIMEOUT", "300")),  # 5 minutes
}

# Webhook configuration
CRM_WEBHOOK_CONFIG = {
    "hubspot": {
        "signature_header": "x-hubspot-signature",
        "algorithm": "sha256",
        "timeout": 30,
    },
    "zoho": {
        "secret_header": "x-zoho-webhook-secret",
        "timeout": 30,
    }
}

# Retry configuration
CRM_RETRY_CONFIG = {
    "max_attempts": int(os.getenv("CRM_MAX_RETRY_ATTEMPTS", "3")),
    "initial_delay": float(os.getenv("CRM_INITIAL_RETRY_DELAY", "1.0")),
    "max_delay": float(os.getenv("CRM_MAX_RETRY_DELAY", "300.0")),
    "backoff_factor": float(os.getenv("CRM_RETRY_BACKOFF_FACTOR", "2.0")),
    "jitter": True,
}

# Provider-specific settings
CRM_PROVIDER_CONFIG = {
    "hubspot": {
        "api_version": "v3",
        "base_url": "https://api.hubapi.com",
        "oauth_scopes": ["contacts", "crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"],
        "webhook_subscriptions": [
            "contact.propertyChange",
            "company.propertyChange", 
            "deal.propertyChange"
        ]
    },
    "zoho": {
        "datacenters": ["US", "EU", "IN", "AU", "JP"],
        "api_version": "v3",
        "oauth_scopes": ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"],
        "webhook_channels": ["notifications", "webhooks"]
    },
    "odoo": {
        "protocols": ["json-rpc", "xml-rpc"],
        "default_timeout": int(os.getenv("ODOO_DEFAULT_TIMEOUT", "30")),
        "max_retries": int(os.getenv("ODOO_MAX_RETRIES", "3")),
    }
}

# Environment variables
CRM_ENV_VARS = {
    "hubspot": {
        "client_id": os.getenv("CRM_HUBSPOT_CLIENT_ID"),
        "client_secret": os.getenv("CRM_HUBSPOT_CLIENT_SECRET"),
        "webhook_secret": os.getenv("CRM_HUBSPOT_WEBHOOK_SECRET"),
    },
    "zoho": {
        "client_id": os.getenv("CRM_ZOHO_CLIENT_ID"),
        "client_secret": os.getenv("CRM_ZOHO_CLIENT_SECRET"),
        "webhook_secret": os.getenv("CRM_ZOHO_WEBHOOK_SECRET"),
    },
    "odoo": {
        "default_url": os.getenv("ODOO_DEFAULT_URL"),
        "default_database": os.getenv("ODOO_DEFAULT_DATABASE"),
    }
}

def get_crm_config(provider: str) -> Dict[str, Any]:
    """Get configuration for specific CRM provider"""
    return {
        "rate_limits": CRM_RATE_LIMITS.get(provider, {}),
        "provider_config": CRM_PROVIDER_CONFIG.get(provider, {}),
        "env_vars": CRM_ENV_VARS.get(provider, {}),
        "webhook_config": CRM_WEBHOOK_CONFIG.get(provider, {}),
    }

def get_rate_limit_config(provider: str) -> Dict[str, Any]:
    """Get rate limiting configuration for provider"""
    return CRM_RATE_LIMITS.get(provider, CRM_RATE_LIMITS["hubspot"])

def get_retry_config() -> Dict[str, Any]:
    """Get retry configuration"""
    return CRM_RETRY_CONFIG.copy()

def get_sync_config() -> Dict[str, Any]:
    """Get sync configuration"""
    return CRM_SYNC_CONFIG.copy()
