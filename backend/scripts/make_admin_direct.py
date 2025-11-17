#!/usr/bin/env python3
"""Direct script to make tenant_id 2 admin - no dependencies needed"""
import os
import sys
from pathlib import Path

# Try to load .env if exists
BACKEND_DIR = Path(__file__).resolve().parent.parent
env_file = BACKEND_DIR / ".env"
if env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
    except ImportError:
        # If dotenv not available, try to parse manually
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

# Get DATABASE_URL
database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set in environment")
    print("Please set DATABASE_URL environment variable or add it to .env file")
    sys.exit(1)

print(f"📡 Connecting to database...")
print(f"   URL: {database_url.split('@')[1] if '@' in database_url else '***'}")

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
    
    engine = create_engine(database_url)
    
    with Session(engine) as session:
        # First, check current status
        result = session.execute(text("SELECT id, email, tenant_id, is_admin FROM users WHERE tenant_id = 2"))
        users = result.fetchall()
        
        if not users:
            print("❌ No users found for tenant_id = 2")
            sys.exit(1)
        
        print(f"\n📋 Found {len(users)} user(s) for tenant_id = 2:")
        for user in users:
            print(f"   - ID: {user[0]}, Email: {user[1]}, Admin: {user[3]}")
        
        # Update to admin
        session.execute(text("UPDATE users SET is_admin = 1 WHERE tenant_id = 2"))
        session.commit()
        
        print(f"\n✅ Updated {len(users)} user(s) to admin")
        
        # Verify
        result = session.execute(text("SELECT id, email, tenant_id, is_admin FROM users WHERE tenant_id = 2"))
        users_after = result.fetchall()
        
        print(f"\n✅ Verification:")
        for user in users_after:
            print(f"   - ID: {user[0]}, Email: {user[1]}, Admin: {user[3]}")
        
        print(f"\n✅ Done! Users in tenant_id = 2 are now admin.")
        print(f"   Note: Users need to logout/login or call /auth/me to refresh their token.")
        
except ImportError as e:
    print(f"❌ Missing dependency: {e}")
    print("Please install: pip install sqlalchemy psycopg2-binary")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

