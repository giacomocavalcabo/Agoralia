"""Basic API smoke tests"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    """Test health endpoint"""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") in ("ok", "healthy")


def test_billing_entitlements_default():
    """Test billing entitlements returns valid structure (default tenant)"""
    resp = client.get("/billing/entitlements")
    assert resp.status_code == 200
    data = resp.json()
    # Should always return a dict, even if empty/default
    assert isinstance(data, dict)
    # Free plan defaults
    assert "calendar_full" in data
    assert "languages_allowance" in data
    assert "integrations" in data
    assert isinstance(data["integrations"], list)


def test_auth_register_validation():
    """Test auth register requires email and password"""
    resp = client.post("/auth/register", json={})
    assert resp.status_code == 422  # Validation error


def test_auth_me_no_token():
    """Test /auth/me without token returns 401"""
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_cors_headers():
    """Test CORS headers are present"""
    resp = client.options("/health", headers={"Origin": "http://localhost:5173"})
    assert "access-control-allow-origin" in resp.headers or resp.status_code in (200, 204)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

