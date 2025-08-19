#!/usr/bin/env python3
"""
Test script for CRM integrations
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from integrations import HubSpotClient, ZohoClient, OdooClient
from services.crm_sync import CrmSyncService


async def test_hubspot_client():
    """Test HubSpot client functionality"""
    print("\n🧪 Testing HubSpot Client...")
    
    try:
        # Mock credentials
        credentials = {
            "access_token": "mock_token",
            "refresh_token": "mock_refresh",
            "expires_at": "2025-12-31T23:59:59Z",
            "portal_id": "12345"
        }
        
        client = HubSpotClient("ws_1", credentials)
        
        # Test healthcheck (will fail with mock token, but should handle gracefully)
        health = await client.healthcheck()
        print(f"✅ Health check: {health['status']}")
        
        # Test field mapping
        mapping = await client.get_field_mapping()
        print(f"✅ Field mapping: {len(mapping)} object types")
        
        print("✅ HubSpot client tests completed")
        return True
        
    except Exception as e:
        print(f"❌ HubSpot client test failed: {e}")
        return False


async def test_zoho_client():
    """Test Zoho client functionality"""
    print("\n🧪 Testing Zoho Client...")
    
    try:
        # Mock credentials
        credentials = {
            "client_id": "mock_client_id",
            "client_secret": "mock_client_secret",
            "refresh_token": "mock_refresh_token",
            "dc": "US"
        }
        
        client = ZohoClient("ws_1", credentials)
        
        # Test field mapping
        mapping = await client.get_field_mapping()
        print(f"✅ Field mapping: {len(mapping)} object types")
        
        print("✅ Zoho client tests completed")
        return True
        
    except Exception as e:
        print(f"❌ Zoho client test failed: {e}")
        return False


async def test_odoo_client():
    """Test Odoo client functionality"""
    print("\n🧪 Testing Odoo Client...")
    
    try:
        # Mock credentials
        credentials = {
            "url": "https://demo.odoo.com",
            "database": "demo",
            "username": "demo",
            "password": "demo"
        }
        
        client = OdooClient("ws_1", credentials)
        
        # Test field mapping
        mapping = await client.get_field_mapping()
        print(f"✅ Field mapping: {len(mapping)} object types")
        
        print("✅ Odoo client tests completed")
        return True
        
    except Exception as e:
        print(f"❌ Odoo client test failed: {e}")
        return False


async def test_crm_sync_service():
    """Test CRM sync service"""
    print("\n🧪 Testing CRM Sync Service...")
    
    try:
        service = CrmSyncService()
        
        # Test getting client (should fail without real connections)
        client = await service.get_client("ws_1", "hubspot")
        if client is None:
            print("✅ Client retrieval handled gracefully when no connection exists")
        
        print("✅ CRM sync service tests completed")
        return True
        
    except Exception as e:
        print(f"❌ CRM sync service test failed: {e}")
        return False


async def test_field_mappings():
    """Test field mapping functionality"""
    print("\n🧪 Testing Field Mappings...")
    
    try:
        # Test default mappings
        from integrations.hubspot_client import HubSpotClient
        from integrations.zoho_client import ZohoClient
        from integrations.odoo_client import OdooClient
        
        # Create mock clients
        hs_client = HubSpotClient("ws_1", {"access_token": "mock"})
        zoho_client = ZohoClient("ws_1", {"client_id": "mock", "client_secret": "mock", "refresh_token": "mock"})
        odoo_client = OdooClient("ws_1", {"url": "mock", "database": "mock", "username": "mock", "password": "mock"})
        
        # Get mappings
        hs_mapping = await hs_client.get_field_mapping()
        zoho_mapping = await zoho_client.get_field_mapping()
        odoo_mapping = await odoo_client.get_field_mapping()
        
        print(f"✅ HubSpot mapping: {len(hs_mapping)} object types")
        print(f"✅ Zoho mapping: {len(zoho_mapping)} object types")
        print(f"✅ Odoo mapping: {len(odoo_mapping)} object types")
        
        # Verify mapping structure
        for provider, mapping in [("HubSpot", hs_mapping), ("Zoho", zoho_mapping), ("Odoo", odoo_mapping)]:
            required_objects = ["contact", "company", "deal"]
            for obj in required_objects:
                if obj in mapping:
                    print(f"✅ {provider} {obj} mapping: {len(mapping[obj])} fields")
                else:
                    print(f"⚠️ {provider} missing {obj} mapping")
        
        print("✅ Field mapping tests completed")
        return True
        
    except Exception as e:
        print(f"❌ Field mapping test failed: {e}")
        return False


async def main():
    """Run all CRM integration tests"""
    print("🚀 Starting CRM Integration Tests...")
    
    tests = [
        test_hubspot_client(),
        test_zoho_client(),
        test_odoo_client(),
        test_crm_sync_service(),
        test_field_mappings()
    ]
    
    results = await asyncio.gather(*tests, return_exceptions=True)
    
    # Count successes
    success_count = sum(1 for r in results if r is True)
    total_count = len(results)
    
    print(f"\n📊 Test Results: {success_count}/{total_count} tests passed")
    
    if success_count == total_count:
        print("🎉 All CRM integration tests passed!")
        return 0
    else:
        print("❌ Some tests failed. Check the output above for details.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
