#!/usr/bin/env python3
"""
Seed script for CRM providers
Creates mock connections and field mappings for testing
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
import secrets

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ..db import get_db, engine
from ..models import HubSpotConnection, CrmFieldMapping
from sqlalchemy.orm import Session


def seed_hubspot_connections():
    """Seed HubSpot connections"""
    db = next(get_db())
    
    try:
        # Check if connections already exist
        existing = db.query(HubSpotConnection).first()
        if existing:
            print("✅ HubSpot connections already exist, skipping...")
            return
        
        # Create mock HubSpot connection
        connection = HubSpotConnection(
            id=f"hs_conn_{secrets.token_urlsafe(8)}",
            workspace_id="ws_1",
            access_token="mock_hubspot_token",
            refresh_token="mock_hubspot_refresh",
            expires_at=datetime.utcnow() + timedelta(hours=1),
            portal_id="12345"
        )
        
        db.add(connection)
        db.commit()
        print("✅ Created HubSpot connection")
        
    except Exception as e:
        print(f"❌ Failed to create HubSpot connection: {e}")
        db.rollback()
    finally:
        db.close()


def seed_crm_mappings():
    """Seed CRM field mappings"""
    db = next(get_db())
    
    try:
        # Check if mappings already exist
        existing = db.query(CrmFieldMapping).first()
        if existing:
            print("✅ CRM mappings already exist, skipping...")
            return
        
        # HubSpot mapping
        hubspot_mapping = CrmFieldMapping(
            id=f"mapping_hs_{secrets.token_urlsafe(8)}",
            workspace_id="ws_1",
            crm_provider="hubspot",
            mapping_json={
                "contact": {
                    "firstname": "firstname",
                    "lastname": "lastname",
                    "phone": "phone",
                    "email": "email",
                    "company": "company",
                    "country": "country"
                },
                "company": {
                    "name": "name",
                    "phone": "phone",
                    "country": "country",
                    "industry": "industry"
                },
                "deal": {
                    "dealname": "dealname",
                    "amount": "amount",
                    "dealstage": "dealstage",
                    "closedate": "closedate"
                }
            }
        )
        
        # Zoho mapping
        zoho_mapping = CrmFieldMapping(
            id=f"mapping_zoho_{secrets.token_urlsafe(8)}",
            workspace_id="ws_1",
            crm_provider="zoho",
            mapping_json={
                "contact": {
                    "firstname": "First_Name",
                    "lastname": "Last_Name",
                    "phone": "Phone",
                    "email": "Email",
                    "company": "Account_Name",
                    "country": "Mailing_Country"
                },
                "company": {
                    "name": "Account_Name",
                    "phone": "Phone",
                    "country": "Billing_Country",
                    "industry": "Industry"
                },
                "deal": {
                    "dealname": "Deal_Name",
                    "amount": "Amount",
                    "dealstage": "Stage",
                    "closedate": "Closing_Date"
                }
            }
        )
        
        # Odoo mapping
        odoo_mapping = CrmFieldMapping(
            id=f"mapping_odoo_{secrets.token_urlsafe(8)}",
            workspace_id="ws_1",
            crm_provider="odoo",
            mapping_json={
                "contact": {
                    "firstname": "name (first part)",
                    "lastname": "name (last part)",
                    "phone": "phone",
                    "email": "email",
                    "company": "parent_id",
                    "country": "country_id"
                },
                "company": {
                    "name": "name",
                    "phone": "phone",
                    "country": "country_id",
                    "industry": "industry"
                },
                "deal": {
                    "dealname": "name",
                    "amount": "expected_revenue",
                    "dealstage": "stage_id",
                    "closedate": "date_deadline"
                }
            }
        )
        
        db.add_all([hubspot_mapping, zoho_mapping, odoo_mapping])
        db.commit()
        print("✅ Created CRM field mappings")
        
    except Exception as e:
        print(f"❌ Failed to create CRM mappings: {e}")
        db.rollback()
    finally:
        db.close()


def create_env_template():
    """Create environment variables template"""
    template = """# CRM Integration Environment Variables
# Copy this to .env and fill in your actual values

# HubSpot
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
HUBSPOT_REDIRECT_URI=https://your-domain.com/crm/hubspot/callback

# Zoho
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
ZOHO_REDIRECT_URI=https://your-domain.com/crm/zoho/callback

# Odoo
ODOO_DEFAULT_URL=https://your-odoo-instance.com
ODOO_DEFAULT_DATABASE=your_database_name
ODOO_DEFAULT_USERNAME=your_username
ODOO_DEFAULT_PASSWORD=your_password

# Optional: API Key for Odoo (alternative to username/password)
ODOO_API_KEY=your_api_key
"""
    
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env.template")
    with open(env_file, "w") as f:
        f.write(template)
    
    print("✅ Created .env.template file")


def main():
    """Main seeding function"""
    print("🌱 Seeding CRM providers...")
    
    # Create database tables if they don't exist
    from models import Base
    Base.metadata.create_all(bind=engine)
    
    # Seed data
    seed_hubspot_connections()
    seed_crm_mappings()
    create_env_template()
    
    print("🎉 CRM providers seeding completed!")


if __name__ == "__main__":
    main()
