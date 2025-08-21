#!/usr/bin/env python3
"""
Script to create admin user for Sprint 11
Creates giacomo.cavalcabo14@gmail.com with admin privileges
"""

import os
import sys
import bcrypt
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db
from models import User, UserAuth

def create_admin_user():
    """Create admin user if it doesn't exist"""
    
    db = next(get_db())
    
    # Check if user already exists
    existing_user = db.query(User).filter(
        User.email == 'giacomo.cavalcabo14@gmail.com'
    ).first()
    
    if existing_user:
        print(f"✅ User {existing_user.email} already exists")
        if existing_user.is_admin_global:
            print("   Already has global admin privileges")
        else:
            print("   Updating to global admin...")
            existing_user.is_admin_global = True
            db.commit()
            print("   ✅ Global admin privileges granted")
        return existing_user
    
    # Create new admin user
    print("🔧 Creating new admin user...")
    
    # Hash password
    password = "Palemone01!"
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    # Create user
    user = User(
        email='giacomo.cavalcabo14@gmail.com',
        name='Giacomo Cavalcabo',
        is_admin_global=True,
        email_verified_at=datetime.now(timezone.utc),  # Auto-verify for admin
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    
    db.add(user)
    db.flush()  # Get the user ID
    
    # Create user auth record
    user_auth = UserAuth(
        user_id=user.id,
        provider='password',
        pass_hash=hashed.decode('utf-8'),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    
    db.add(user_auth)
    db.commit()
    
    print(f"✅ Admin user created successfully!")
    print(f"   Email: {user.email}")
    print(f"   Password: {password}")
    print(f"   Global Admin: {user.is_admin_global}")
    print(f"   Email Verified: {user.email_verified_at}")
    
    return user

if __name__ == "__main__":
    try:
        create_admin_user()
        print("\n🎉 Admin user setup complete!")
        print("   You can now login with giacomo.cavalcabo14@gmail.com / Palemone01!")
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        sys.exit(1)
