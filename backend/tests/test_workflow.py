import importlib

from fastapi.testclient import TestClient


def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SDLC_DATABASE_PATH", str(tmp_path / "test.db"))
    import backend.src.main as main
    importlib.reload(main)
    main.init_db()
    return TestClient(main.app)


def create(c):
    return c.post("/api/projects", json={"name": "Demo"}).json()["data"]["public_id"]


def test_requirement_runs_complete_pipeline(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch); project = create(c)
    result = c.post(f"/api/projects/{project}/requirements", json={"raw_requirement": "Users can save a shopping list. Users can rename a shopping list."})
    assert result.status_code == 201 and result.json()["data"]["state"] == "COMPLETED"
    data = c.get(f"/api/projects/{project}").json()["data"]
    assert data["artifacts"]["qa_handoff"]["status"] == "ready"
    assert data["artifacts"]["traceability"]["coverage"] == "100%"
    assert all(event["actor"] == "system" for event in data["audit_events"])


def test_run_requires_requirement(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch); project = create(c)
    response = c.post(f"/api/projects/{project}/workflow/run")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REQUIREMENT_REQUIRED"


def test_duplicate_and_empty_requirement_are_rejected(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch); project = create(c)
    payload = {"raw_requirement": "Users can export reports to CSV."}
    assert c.post(f"/api/projects/{project}/requirements", json=payload).status_code == 201
    assert c.post(f"/api/projects/{project}/requirements", json=payload).status_code == 409
    assert c.post(f"/api/projects/{project}/requirements", json={"raw_requirement": "   "}).status_code == 422


def test_invalid_pipeline_input_records_retry_safe_failure(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch); project = create(c)
    response = c.post(f"/api/projects/{project}/requirements", json={"raw_requirement": "short"})
    assert response.status_code == 201
    assert response.json()["data"]["failure"]["next_action"] == "submit_corrected_requirement"
    assert c.get(f"/api/projects/{project}").json()["data"]["state"] == "FAILED"
