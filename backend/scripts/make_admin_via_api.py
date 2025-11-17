#!/usr/bin/env python3
"""Make admin via API endpoint"""
import os
import sys
import requests
from pathlib import Path

# Try to get API URL and token
BACKEND_DIR = Path(__file__).resolve().parent.parent
env_file = BACKEND_DIR / ".env"

# Load .env if exists
if env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
    except ImportError:
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

API_URL = os.getenv("API_BASE_URL", "https://api.agoralia.app")
ADMIN_TOOLS_ENABLED = os.getenv("ADMIN_TOOLS_ENABLED", "true")
TOKEN = os.getenv("ADMIN_TOKEN")  # Optional: can be set in .env

tenant_id = 2

print(f"📡 Calling API: {API_URL}/admin-tools/make-admin/{tenant_id}")

try:
    headers = {}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
        print(f"   Using token from ADMIN_TOKEN env var")
    else:
        print(f"   ⚠ No ADMIN_TOKEN set - endpoint may require authentication")
    
    # Set ADMIN_TOOLS_ENABLED in request (if endpoint checks it)
    response = requests.post(
        f"{API_URL}/admin-tools/make-admin/{tenant_id}",
        headers=headers,
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Success!")
        print(f"   Tenant ID: {data.get('tenant_id')}")
        print(f"   Total users: {data.get('total_users')}")
        print(f"   Updated to admin: {data.get('updated_to_admin')}")
        print(f"\n   Users:")
        for user in data.get('users', []):
            print(f"     - ID: {user['id']}, Email: {user['email']}, Admin: {user['is_admin']}")
    elif response.status_code == 403:
        print(f"❌ Forbidden: {response.text}")
        print(f"   Make sure ADMIN_TOOLS_ENABLED is set in backend environment")
    elif response.status_code == 401:
        print(f"❌ Unauthorized: {response.text}")
        print(f"   Set ADMIN_TOKEN in .env with a valid token")
    else:
        print(f"❌ Error {response.status_code}: {response.text}")
        sys.exit(1)
        
except requests.exceptions.RequestException as e:
    print(f"❌ Network error: {e}")
    print(f"   Make sure the backend is running and accessible at {API_URL}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

