"""
Test per verificare che le rotte campaigns siano registrate correttamente.
Questo test dimostra il bug attuale: /api/campaigns restituisce 404.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app

def test_campaigns_routes_registered():
    """Test che verifica che le rotte campaigns siano registrate nell'OpenAPI spec."""
    client = TestClient(app)
    spec = client.get("/openapi.json").json()
    paths = spec.get("paths", {}).keys()
    
    # Verifica che le rotte campaigns siano presenti
    campaign_paths = [p for p in paths if p.startswith("/api/campaigns")]
    assert len(campaign_paths) > 0, f"Campaigns routes not registered. Found paths: {list(paths)[:10]}..."
    
    # Verifica rotte specifiche
    expected_paths = ["/api/campaigns", "/api/campaigns/{campaign_id}"]
    for expected in expected_paths:
        assert expected in paths, f"Expected path {expected} not found in OpenAPI spec"

def test_campaigns_endpoint_accessible():
    """Test che verifica che l'endpoint /api/campaigns sia accessibile (non 404)."""
    client = TestClient(app)
    
    # Test con header workspace
    response = client.get("/api/campaigns", headers={"X-Workspace-Id": "ws_1"})
    
    # Dovrebbe essere 200, 204, o 401/403, MA NON 404
    assert response.status_code != 404, f"Campaigns endpoint returns 404. Status: {response.status_code}, Response: {response.text}"
    
    # Se è 200, verifica che la risposta sia valida
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, dict), "Response should be a dictionary"
        assert "items" in data or "campaigns" in data, "Response should contain items or campaigns key"
