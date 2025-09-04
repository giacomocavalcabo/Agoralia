#!/usr/bin/env python3
"""
Test JWT state management
"""
import os
import sys
sys.path.append('backend')

from backend.utils.oauth_state import create_oauth_state, extract_oauth_info

def test_jwt_state():
    """Test JWT state creation and validation"""
    print("🧪 Testing JWT State Management")
    print("=" * 40)
    
    # Test data
    user_id = "test_user_123"
    workspace_id = "ws_1"
    provider = "hubspot"
    
    print(f"Creating JWT state for:")
    print(f"  User ID: {user_id}")
    print(f"  Workspace ID: {workspace_id}")
    print(f"  Provider: {provider}")
    
    try:
        # Create JWT state
        state = create_oauth_state(user_id, workspace_id, provider)
        print(f"\n✅ JWT State created successfully")
        print(f"State length: {len(state)}")
        print(f"State preview: {state[:50]}...")
        
        # Validate JWT state
        oauth_info = extract_oauth_info(state)
        if oauth_info:
            print(f"\n✅ JWT State validation successful")
            print(f"Extracted info:")
            print(f"  User ID: {oauth_info['user_id']}")
            print(f"  Workspace ID: {oauth_info['workspace_id']}")
            print(f"  Provider: {oauth_info['provider']}")
            print(f"  Nonce: {oauth_info['nonce']}")
        else:
            print(f"\n❌ JWT State validation failed")
            return False
            
        # Test with invalid state
        invalid_state = "invalid.jwt.token"
        invalid_info = extract_oauth_info(invalid_state)
        if not invalid_info:
            print(f"\n✅ Invalid JWT correctly rejected")
        else:
            print(f"\n❌ Invalid JWT was accepted (should be rejected)")
            return False
            
        print(f"\n🎉 All JWT state tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ JWT State test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_jwt_state()
    if success:
        print("\n✅ JWT State management is working correctly")
        print("The 'expired' error is likely due to other issues:")
        print("  1. Client Secret mismatch")
        print("  2. Redirect URI mismatch") 
        print("  3. Authorization code already used")
        print("  4. Network/timing issues")
    else:
        print("\n❌ JWT State management has issues")
        print("This could be the cause of the 'expired' error")
