"""Test script for phone number setup and test calls via HTTP API"""
import os
import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    BACKEND_DIR = Path(__file__).resolve().parent
    load_dotenv(BACKEND_DIR / ".env")
except ImportError:
    pass

# Try to import httpx, if not available use requests
try:
    import httpx
    USE_HTTPX = True
except ImportError:
    try:
        import requests
        USE_HTTPX = False
    except ImportError:
        print("❌ Error: Neither httpx nor requests is installed")
        print("   Install with: pip install httpx  or  pip install requests")
        sys.exit(1)

# Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY")  # Optional, if needed
RETELL_API_KEY = os.getenv("RETELL_API_KEY")  # Check if Retell API key is available


async def test_purchase_and_call(test_call_to: str, agent_id: str = None, base_url: str = BASE_URL):
    """Test: Purchase a number via Retell and make a test call"""
    print("=" * 60)
    print("TEST 1: Purchase phone number and make test call")
    print("=" * 60)
    
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    
    # Step 1: Purchase number
    print("\n1. Purchasing phone number via Retell...")
    purchase_body = {
        "number_provider": "twilio",
        "inbound_agent_id": agent_id,
        "outbound_agent_id": agent_id,
        "nickname": "Test Number",
    }
    
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{base_url}/calls/retell/phone-numbers/create",
                headers=headers,
                json=purchase_body,
            )
            purchase_result = resp.json() if resp.status_code < 500 else {"error": resp.text, "status_code": resp.status_code}
            print(f"Purchase result: {json.dumps(purchase_result, indent=2)}")
            
            if resp.status_code >= 400 or not purchase_result.get("success"):
                print("❌ Failed to purchase number")
                return purchase_result
            
            phone_number = purchase_result.get("response", {}).get("phone_number")
            if not phone_number:
                print("❌ No phone number returned")
                return purchase_result
            
            print(f"✅ Phone number purchased: {phone_number}")
            
            # Step 2: Make test call
            print(f"\n2. Making test call to {test_call_to}...")
            call_body = {
                "to": test_call_to,
                "from_number": phone_number,
                "agent_id": agent_id,
            }
            
            resp = await client.post(
                f"{base_url}/calls/retell/outbound",
                headers=headers,
                json=call_body,
            )
            call_result = resp.json() if resp.status_code < 500 else {"error": resp.text, "status_code": resp.status_code}
            print(f"Call result: {json.dumps(call_result, indent=2)}")
            
            if call_result.get("success"):
                print(f"✅ Test call successful!")
            else:
                print(f"❌ Test call failed")
            
            return {
                "purchase": purchase_result,
                "call": call_result,
            }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


async def test_import_and_call(
    phone_number: str,
    termination_uri: str,
    test_call_to: str,
    base_url: str = BASE_URL,
    sip_trunk_user_name: str = None,
    sip_trunk_password: str = None,
    agent_id: str = None,
    nickname: str = None,
):
    """Test: Import number from Zadarma and make a test call"""
    print("=" * 60)
    print("TEST 2: Import phone number from Zadarma and make test call")
    print("=" * 60)
    
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    
    # Step 1: Import number
    print(f"\n1. Importing phone number {phone_number} from Zadarma...")
    import_body = {
        "phone_number": phone_number,
        "termination_uri": termination_uri,
        "sip_trunk_user_name": sip_trunk_user_name,
        "sip_trunk_password": sip_trunk_password,
        "inbound_agent_id": agent_id,
        "outbound_agent_id": agent_id,
        "nickname": nickname or "Zadarma Test",
    }
    
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{base_url}/calls/retell/phone-numbers/import",
                headers=headers,
                json=import_body,
            )
            import_result = resp.json() if resp.status_code < 500 else {"error": resp.text, "status_code": resp.status_code}
            print(f"Import result: {json.dumps(import_result, indent=2)}")
            
            if resp.status_code >= 400 or not import_result.get("success"):
                print("❌ Failed to import number")
                return import_result
            
            imported_number = import_result.get("phone_number")
            if not imported_number:
                print("❌ No phone number returned")
                return import_result
            
            print(f"✅ Phone number imported: {imported_number}")
            
            # Step 2: Make test call
            print(f"\n2. Making test call to {test_call_to}...")
            # Normalize test_call_to to E.164 if needed
            test_to = test_call_to
            if not test_to.startswith("+"):
                test_to = "+39" + test_to.lstrip("0")
            
            call_body = {
                "to": test_to,
                "from_number": imported_number,
                "agent_id": agent_id,
            }
            
            resp = await client.post(
                f"{base_url}/calls/retell/outbound",
                headers=headers,
                json=call_body,
            )
            call_result = resp.json() if resp.status_code < 500 else {"error": resp.text, "status_code": resp.status_code}
            print(f"Call result: {json.dumps(call_result, indent=2)}")
            
            if call_result.get("success"):
                print(f"✅ Test call successful!")
            else:
                print(f"❌ Test call failed")
            
            return {
                "import": import_result,
                "call": call_result,
            }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


async def test_phone_setup_endpoint(
    test_call_to: str,
    base_url: str = BASE_URL,
    purchase_phone: bool = False,
    phone_number: str = None,
    termination_uri: str = None,
    sip_trunk_user_name: str = None,
    sip_trunk_password: str = None,
    agent_id: str = None,
    number_provider: str = "twilio",
    nickname: str = None,
):
    """Test using the test-setup endpoint (all-in-one)"""
    print("=" * 60)
    print("TEST: Using test-setup endpoint (all-in-one)")
    print("=" * 60)
    
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    
    body = {
        "test_call_to": test_call_to,
        "purchase_phone": purchase_phone,
        "number_provider": number_provider,
    }
    
    if purchase_phone:
        if agent_id:
            body["agent_id"] = agent_id
        if nickname:
            body["nickname"] = nickname
    else:
        if not phone_number or not termination_uri:
            print("❌ Error: phone_number and termination_uri are required for import")
            return
        body["phone_number"] = phone_number
        body["termination_uri"] = termination_uri
        if sip_trunk_user_name:
            body["sip_trunk_user_name"] = sip_trunk_user_name
        if sip_trunk_password:
            body["sip_trunk_password"] = sip_trunk_password
        if agent_id:
            body["agent_id"] = agent_id
        if nickname:
            body["nickname"] = nickname
    
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            print(f"\nMaking request to {base_url}/calls/retell/phone-numbers/test-setup")
            print(f"Body: {json.dumps(body, indent=2)}")
            
            resp = await client.post(
                f"{base_url}/calls/retell/phone-numbers/test-setup",
                headers=headers,
                json=body,
            )
            result = resp.json() if resp.status_code < 500 else {"error": resp.text, "status_code": resp.status_code}
            print(f"\nResult: {json.dumps(result, indent=2)}")
            
            if resp.status_code >= 400:
                print("❌ Request failed")
            elif result.get("errors"):
                print("❌ Errors occurred")
            else:
                print("✅ Test completed!")
            
            return result
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


async def main():
    """Main test function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test phone number setup and calls")
    parser.add_argument("--base-url", default=BASE_URL, help="API base URL")
    parser.add_argument("--test-call-to", default="3408994869", help="Phone number to call for test")
    parser.add_argument("--agent-id", help="Retell agent ID")
    parser.add_argument("--mode", choices=["purchase", "import", "test-setup"], default="test-setup",
                       help="Test mode: purchase, import, or test-setup (all-in-one)")
    parser.add_argument("--phone-number", help="Phone number to import (for import mode)")
    parser.add_argument("--termination-uri", help="Termination URI for import (for import mode)")
    parser.add_argument("--sip-user", help="SIP trunk user name")
    parser.add_argument("--sip-password", help="SIP trunk password")
    parser.add_argument("--nickname", help="Nickname for the number")
    parser.add_argument("--number-provider", default="twilio", help="Provider for purchase: twilio or telnyx")
    parser.add_argument("--purchase", action="store_true", help="Purchase number instead of importing (for test-setup mode)")
    
    args = parser.parse_args()
    
    # Normalize test_call_to to E.164 if needed
    test_call_to = args.test_call_to
    if not test_call_to.startswith("+"):
        test_call_to = "+39" + test_call_to.lstrip("0")
    
    print(f"Testing with:")
    print(f"  - Base URL: {args.base_url}")
    print(f"  - Test call to: {test_call_to}")
    print(f"  - Agent ID: {args.agent_id or 'Not provided (will use number-bound agent)'}")
    print(f"  - Mode: {args.mode}")
    print()
    
    if args.mode == "test-setup":
        result = await test_phone_setup_endpoint(
            test_call_to=test_call_to,
            base_url=args.base_url,
            purchase_phone=args.purchase,
            phone_number=args.phone_number,
            termination_uri=args.termination_uri,
            sip_trunk_user_name=args.sip_user,
            sip_trunk_password=args.sip_password,
            agent_id=args.agent_id,
            number_provider=args.number_provider,
            nickname=args.nickname,
        )
    elif args.mode == "purchase":
        result = await test_purchase_and_call(test_call_to, args.agent_id, args.base_url)
    elif args.mode == "import":
        if not args.phone_number or not args.termination_uri:
            print("❌ Error: --phone-number and --termination-uri are required for import mode")
            return
        result = await test_import_and_call(
            phone_number=args.phone_number,
            termination_uri=args.termination_uri,
            test_call_to=test_call_to,
            base_url=args.base_url,
            sip_trunk_user_name=args.sip_user,
            sip_trunk_password=args.sip_password,
            agent_id=args.agent_id,
            nickname=args.nickname,
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
