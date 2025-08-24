#!/usr/bin/env python3
"""
Test script for the compliance system
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_compliance_engine():
    """Test the compliance engine"""
    print("🧪 Testing Compliance Engine...")
    
    try:
        from services.compliance_engine import compliance_engine
        
        # Test country rules loading
        print(f"✅ Loaded compliance rules for {len(compliance_engine.rules.get('countries', []))} countries")
        
        # Test contact classification
        test_contact = {
            "contact_class": "b2b",
            "relationship_basis": "existing",
            "opt_in": None,
            "national_dnc": "unknown"
        }
        
        category, reasons = compliance_engine.classify_contact(test_contact, "IT")
        print(f"✅ B2B IT classification: {category} - {reasons}")
        
        test_contact_b2c = {
            "contact_class": "b2c",
            "relationship_basis": "none",
            "opt_in": False,
            "national_dnc": "unknown"
        }
        
        category, reasons = compliance_engine.classify_contact(test_contact_b2c, "IT")
        print(f"✅ B2C IT classification: {category} - {reasons}")
        
        return True
        
    except Exception as e:
        print(f"❌ Compliance engine test failed: {e}")
        return False

def test_dnc_service():
    """Test the DNC service"""
    print("\n🧪 Testing DNC Service...")
    
    try:
        from dnc_service import dnc_service
        
        # Test supported countries
        countries = dnc_service.get_supported_countries()
        print(f"✅ Supported countries: {countries}")
        
        # Test DNC check
        in_registry, proof_url = dnc_service.check_dnc("US", "+15551234567")
        print(f"✅ US DNC check: in_registry={in_registry}, proof_url={proof_url}")
        
        in_registry, proof_url = dnc_service.check_dnc("IT", "+39021234567")
        print(f"✅ IT DNC check: in_registry={in_registry}, proof_url={proof_url}")
        
        return True
        
    except Exception as e:
        print(f"❌ DNC service test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Compliance System Tests\n")
    
    compliance_ok = test_compliance_engine()
    dnc_ok = test_dnc_service()
    
    print(f"\n📊 Test Results:")
    print(f"   Compliance Engine: {'✅ PASS' if compliance_ok else '❌ FAIL'}")
    print(f"   DNC Service: {'✅ PASS' if dnc_ok else '❌ FAIL'}")
    
    if compliance_ok and dnc_ok:
        print("\n🎉 All tests passed! Compliance system is ready.")
        return 0
    else:
        print("\n💥 Some tests failed. Check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
