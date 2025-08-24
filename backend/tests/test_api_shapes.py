from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_numbers_shape_ok():
    r = client.get("/numbers", headers={"X-Workspace-Id": "ws_1"})
    assert r.status_code == 200
    body = r.json()
    assert "data" in body and isinstance(body["data"], list)
    assert "total" in body and isinstance(body["total"], int)
    assert "items" in body  # retro-compat

def test_campaigns_list_ok():
    r = client.get("/campaigns", headers={"X-Workspace-Id": "ws_1"})
    assert r.status_code == 200
    body = r.json()
    assert "data" in body and isinstance(body["data"], list)
    assert "total" in body
    assert "items" in body

def test_kb_progress_tolerant_no_header():
    r = client.get("/kb/progress")  # niente X-Workspace-Id
    assert r.status_code == 200
    body = r.json()
    assert "items" in body

def test_kb_progress_demo(monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "1")
    r = client.get("/kb/progress")
    assert r.status_code == 200
    assert len(r.json().get("items", [])) >= 1
