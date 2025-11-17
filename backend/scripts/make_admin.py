"""Script to make a user admin by tenant_id"""
import os
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy.orm import Session
from config.database import engine
from models.users import User


def make_admin_by_tenant_id(tenant_id: int):
    """Make all users in a tenant admin"""
    with Session(engine) as session:
        users = session.query(User).filter(User.tenant_id == tenant_id).all()
        
        if not users:
            print(f"❌ No users found for tenant_id {tenant_id}")
            return
        
        print(f"Found {len(users)} user(s) for tenant_id {tenant_id}:")
        for user in users:
            print(f"  - User ID: {user.id}, Email: {user.email}, Current admin: {user.is_admin}")
        
        # Update all users in the tenant to be admin
        for user in users:
            user.is_admin = 1
        
        session.commit()
        
        print(f"\n✅ Made {len(users)} user(s) admin for tenant_id {tenant_id}")
        print("\nUpdated users:")
        for user in users:
            print(f"  - User ID: {user.id}, Email: {user.email}, Admin: {user.is_admin}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_admin.py <tenant_id>")
        print("Example: python make_admin.py 2")
        sys.exit(1)
    
    try:
        tenant_id = int(sys.argv[1])
        make_admin_by_tenant_id(tenant_id)
    except ValueError:
        print(f"❌ Invalid tenant_id: {sys.argv[1]}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

