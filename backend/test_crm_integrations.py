#!/usr/bin/env python3
"""
Test script for CRM integrations
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def test_crm_imports():
    """Test that all CRM modules can be imported"""
    print("🧪 Testing CRM module imports...")
    
    try:
        # Test models
        from models import (
            CrmProvider, CrmConnection, CrmEntityLink, CrmFieldMapping,
            CrmSyncCursor, CrmSyncLog, CrmWebhookEvent
        )
        print("✅ CRM models imported successfully")
        
        # Test integrations
        from integrations import HubSpotClient, ZohoClient, OdooClient
        print("✅ CRM clients imported successfully")
        
        # Test services
        from services.crm_sync import CrmSyncService
        print("✅ CRM sync service imported successfully")
        
        # Test workers
        from workers.crm_jobs import (
            crm_pull_delta_job, crm_push_outcomes_job, crm_backfill_job,
            crm_webhook_dispatcher_job, crm_polling_job, crm_scheduler_job
        )
        print("✅ CRM jobs imported successfully")
        
        # Test router
        from routers.crm import router
        print("✅ CRM router imported successfully")
        
        # Test config
        from config.crm import get_crm_config, get_rate_limit_config
        print("✅ CRM config imported successfully")
        
        # Test utils
        from utils.rate_limiter import RateLimiter, rate_limited, retry_with_backoff
        print("✅ Rate limiter imported successfully")
        
        # Test metrics
        from metrics import (
            crm_requests_total, crm_errors_total, crm_sync_duration,
            track_crm_operation, track_entities_synced
        )
        print("✅ CRM metrics imported successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False


async def test_crm_service():
    """Test CRM sync service basic functionality"""
    print("\n🧪 Testing CRM sync service...")
    
    try:
        from services.crm_sync import CrmSyncService
        
        service = CrmSyncService()
        print("✅ CRM sync service created successfully")
        
        # Test idempotency key generation
        test_data = {"email": "test@example.com", "name": "Test User"}
        idempotency_key = service._generate_idempotency_key("hubspot", "contact", "create", test_data)
        print(f"✅ Idempotency key generated: {idempotency_key[:16]}...")
        
        # Test conflict resolution
        local_data = {"email": "test@example.com", "name": "Local Name"}
        remote_data = {"email": "test@example.com", "name": "Remote Name"}
        
        resolved = service._resolve_contact_conflicts("hubspot", local_data, remote_data)
        print(f"✅ Conflict resolved: {resolved['name']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Service test failed: {e}")
        return False


async def test_crm_config():
    """Test CRM configuration"""
    print("\n🧪 Testing CRM configuration...")
    
    try:
        from config.crm import get_crm_config, get_rate_limit_config
        
        # Test rate limit config
        rate_config = get_rate_limit_config("hubspot")
        print(f"✅ HubSpot rate limit config: {rate_config}")
        
        # Test CRM config
        crm_config = get_crm_config()
        print(f"✅ CRM config loaded: {len(crm_config)} sections")
        
        return True
        
    except Exception as e:
        print(f"❌ Config test failed: {e}")
        return False


async def test_rate_limiter():
    """Test rate limiter functionality"""
    print("\n🧪 Testing rate limiter...")
    
    try:
        from utils.rate_limiter import RateLimiter, rate_limited, retry_with_backoff
        
        # Test rate limiter creation
        limiter = RateLimiter("hubspot")
        print("✅ Rate limiter created successfully")
        
        # Test token acquisition
        acquired = await limiter.acquire()
        print(f"✅ Token acquired: {acquired}")
        
        return True
        
    except Exception as e:
        print(f"❌ Rate limiter test failed: {e}")
        return False


async def main():
    """Run all tests"""
    print("🚀 Starting CRM integration tests...\n")
    
    tests = [
        test_crm_imports(),
        test_crm_service(),
        test_crm_config(),
        test_rate_limiter()
    ]
    
    results = await asyncio.gather(*tests, return_exceptions=True)
    
    print("\n" + "="*50)
    print("📊 Test Results:")
    print("="*50)
    
    passed = 0
    total = len(tests)
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"❌ Test {i+1} failed with exception: {result}")
        elif result:
            print(f"✅ Test {i+1} passed")
            passed += 1
        else:
            print(f"❌ Test {i+1} failed")
    
    print(f"\n🎯 Final Score: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! CRM integrations are ready for deployment.")
        return True
    else:
        print("⚠️  Some tests failed. Please review the errors above.")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
