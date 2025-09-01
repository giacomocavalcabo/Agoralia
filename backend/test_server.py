#!/usr/bin/env python3
"""
Simple test script to verify FastAPI app works
"""
import uvicorn
from main import app

if __name__ == "__main__":
    print("🚀 Starting test server...")
    print(f"📊 App title: {app.title}")
    print(f"🔗 Routes count: {len(app.routes)}")
    
    # Test specific routes
    auth_routes = [r for r in app.routes if hasattr(r, 'path') and 'auth' in r.path]
    print(f"🔐 Auth routes: {len(auth_routes)}")
    for r in auth_routes[:5]:  # Show first 5
        print(f"  - {r.path} [{r.methods}]")
    
    print("\n🌐 Starting server on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
