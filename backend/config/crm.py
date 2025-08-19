"""
CRM Configuration - Environment variables and settings
"""
import os
from dataclasses import dataclass
from cryptography.fernet import Fernet
from typing import Optional


@dataclass
class CrmConfig:
    """CRM configuration settings"""
    
    # HubSpot
    hubspot_client_id: str = os.getenv("CRM_HUBSPOT_CLIENT_ID", "")
    hubspot_client_secret: str = os.getenv("CRM_HUBSPOT_CLIENT_SECRET", "")
    hubspot_redirect_uri: str = os.getenv("CRM_HUBSPOT_REDIRECT_URI", "")
    
    # Zoho
    zoho_client_id: str = os.getenv("CRM_ZOHO_CLIENT_ID", "")
    zoho_client_secret: str = os.getenv("CRM_ZOHO_CLIENT_SECRET", "")
    zoho_redirect_uri: str = os.getenv("CRM_ZOHO_REDIRECT_URI", "")
    
    # Odoo
    odoo_default_url: str = os.getenv("ODOO_DEFAULT_URL", "")
    odoo_default_database: str = os.getenv("ODOO_DEFAULT_DATABASE", "")
    odoo_default_username: str = os.getenv("ODOO_DEFAULT_USERNAME", "")
    odoo_default_password: str = os.getenv("ODOO_DEFAULT_PASSWORD", "")
    odoo_api_key: str = os.getenv("ODOO_API_KEY", "")
    odoo_timeout: int = int(os.getenv("ODOO_DEFAULT_TIMEOUT", "30"))
    
    # Webhooks
    webhook_secret: str = os.getenv("CRM_WEBHOOK_SECRET", "default_secret_change_in_production")
    
    # Sync Configuration
    sync_page_size: int = int(os.getenv("CRM_SYNC_PAGE_SIZE", "200"))
    sync_rate_limit: int = int(os.getenv("CRM_SYNC_RPS", "5"))
    sync_timeout: int = int(os.getenv("CRM_SYNC_TIMEOUT", "30"))
    
    # Encryption
    encryption_key: str = os.getenv("CRM_ENCRYPTION_KEY", "")
    
    def __post_init__(self):
        """Validate configuration after initialization"""
        if not self.encryption_key:
            # Generate a key for development (DO NOT use in production)
            self.encryption_key = Fernet.generate_key().decode()
            print("⚠️ Using generated encryption key for CRM tokens. Set CRM_ENCRYPTION_KEY in production!")
    
    def get_fernet(self) -> Fernet:
        """Get Fernet cipher for token encryption/decryption"""
        return Fernet(self.encryption_key.encode())
    
    def encrypt_token(self, token: str) -> str:
        """Encrypt a token for storage"""
        if not token:
            return ""
        return self.get_fernet().encrypt(token.encode()).decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt a token from storage"""
        if not encrypted_token:
            return ""
        try:
            return self.get_fernet().decrypt(encrypted_token.encode()).decode()
        except Exception:
            return ""  # Return empty string if decryption fails
    
    def is_provider_configured(self, provider: str) -> bool:
        """Check if a provider is properly configured"""
        if provider == "hubspot":
            return bool(self.hubspot_client_id and self.hubspot_client_secret)
        elif provider == "zoho":
            return bool(self.zoho_client_id and self.zoho_client_secret)
        elif provider == "odoo":
            return bool(self.odoo_default_url and self.odoo_default_database)
        return False
    
    def get_oauth_redirect_uri(self, provider: str) -> str:
        """Get OAuth redirect URI for provider"""
        if provider == "hubspot":
            return self.hubspot_redirect_uri
        elif provider == "zoho":
            return self.zoho_redirect_uri
        return ""


# Global configuration instance
crm_config = CrmConfig()
