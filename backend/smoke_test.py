#!/usr/bin/env python3
"""Simple smoke test script - no dependencies beyond FastAPI test client"""
import sys
from fastapi.testclient import TestClient

try:
    from main import app
except Exception as e:
    print(f"❌ Failed to import app: {e}")
    sys.exit(1)

client = TestClient(app)
failed = []


def check(name, resp, expected_status=200, check_json=True):
    """Check response and record failures"""
    status = resp.status_code
    if status != expected_status:
        failed.append(f"❌ {name}: expected {expected_status}, got {status}")
        print(f"❌ {name}: HTTP {status}")
        if resp.text:
            print(f"   Response: {resp.text[:200]}")
        return False
    
    if check_json:
        try:
            data = resp.json()
            print(f"✅ {name}: HTTP {status}, JSON OK")
            return True
        except Exception as e:
            failed.append(f"❌ {name}: not valid JSON: {e}")
            print(f"❌ {name}: not valid JSON")
            return False
    
    print(f"✅ {name}: HTTP {status}")
    return True


print("🧪 Running smoke tests...\n")

# Test 1: Health
try:
    resp = client.get("/health")
    check("GET /health", resp)
except Exception as e:
    failed.append(f"❌ GET /health: exception: {e}")

# Test 2: Entitlements (should not 500)
try:
    resp = client.get("/billing/entitlements")
    if check("GET /billing/entitlements", resp):
        data = resp.json()
        if not isinstance(data, dict):
            failed.append("❌ GET /billing/entitlements: response is not a dict")
        if "integrations" not in data:
            failed.append("❌ GET /billing/entitlements: missing 'integrations' key")
        elif not isinstance(data["integrations"], list):
            failed.append("❌ GET /billing/entitlements: 'integrations' is not a list")
except Exception as e:
    failed.append(f"❌ GET /billing/entitlements: exception: {e}")

# Test 3: Auth me without token (should 401)
try:
    resp = client.get("/auth/me")
    check("GET /auth/me (no token)", resp, expected_status=401)
except Exception as e:
    failed.append(f"❌ GET /auth/me: exception: {e}")

# Test 4: Metrics endpoints (should not crash)
try:
    resp = client.get("/metrics/daily?days=7")
    check("GET /metrics/daily", resp)
except Exception as e:
    failed.append(f"❌ GET /metrics/daily: exception: {e}")

try:
    resp = client.get("/metrics/outcomes?days=7")
    check("GET /metrics/outcomes", resp)
except Exception as e:
    failed.append(f"❌ GET /metrics/outcomes: exception: {e}")

# Test 5: Register validation (should 422)
try:
    resp = client.post("/auth/register", json={})
    check("POST /auth/register (empty)", resp, expected_status=422)
except Exception as e:
    failed.append(f"❌ POST /auth/register: exception: {e}")

print("\n" + "="*50)
if failed:
    print(f"❌ {len(failed)} test(s) failed:")
    for f in failed:
        print(f"  {f}")
    sys.exit(1)
else:
    print("✅ All smoke tests passed!")
    sys.exit(0)

