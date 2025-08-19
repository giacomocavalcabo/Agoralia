"""
CRM Integrations package
"""

from .base import (
    ClientBase, 
    CrmError, 
    RateLimitError, 
    AuthenticationError, 
    ValidationError
)
from .hubspot_client import HubSpotClient
from .zoho_client import ZohoClient
from .odoo_client import OdooClient

__all__ = [
    "ClientBase",
    "CrmError", 
    "RateLimitError",
    "AuthenticationError",
    "ValidationError",
    "HubSpotClient",
    "ZohoClient", 
    "OdooClient"
]
