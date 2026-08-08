import importlib
from fastapi.testclient import TestClient

def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SDLC_DATABASE_PATH", str(tmp_path / "test.db"))
    import backend.src.main as main
    importlib.reload(main); main.init_db()
    return TestClient(main.app)

def create(c): return c.post("/api/projects",json={"name":"Automated"}).json()["data"]["public_id"]

def test_agents_progress_one_stage_at_a_time_with_approval_gates(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=create(c)
    response=c.post(f"/api/projects/{p}/requirements",json={"raw_requirement":"Users can save a shopping list. Users can rename a shopping list."})
    assert response.status_code==201 and response.json()["data"]["state"]=="REQUIREMENT_CAPTURED"
    assert c.post(f"/api/projects/{p}/analysis/generate").json()["data"]["state"]=="ANALYSIS_COMPLETED"
    assert c.post(f"/api/projects/{p}/brd/generate").json()["data"]["state"]=="BRD_AWAITING_APPROVAL"
    blocked=c.post(f"/api/projects/{p}/automation/run-next").json()["data"]
    assert blocked["status"]=="blocked"
    assert c.post(f"/api/projects/{p}/brd/approve",json={"reviewer":"QA"}).json()["data"]["state"]=="BRD_APPROVED"
    assert c.post(f"/api/projects/{p}/backlog/generate").json()["data"]["state"]=="BACKLOG_AWAITING_APPROVAL"
    assert c.post(f"/api/projects/{p}/backlog/approve",json={"reviewer":"QA"}).json()["data"]["state"]=="BACKLOG_APPROVED"
    assert c.post(f"/api/projects/{p}/tests/generate").json()["data"]["state"]=="TESTS_GENERATED"
    assert c.post(f"/api/projects/{p}/traceability/generate").json()["data"]["state"]=="TRACEABILITY_VALIDATED"
    assert c.post(f"/api/projects/{p}/qa-handoff/generate").json()["data"]["state"]=="COMPLETED"
    data=c.get(f"/api/projects/{p}").json()["data"]
    assert data["artifacts"]["qa_handoff"]["status"]=="ready"

def test_duplicate_and_missing_requirement_are_rejected(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=create(c); payload={"raw_requirement":"Users can export reports to CSV."}
    assert c.post(f"/api/projects/{p}/requirements",json=payload).status_code==201
    assert c.post(f"/api/projects/{p}/requirements",json=payload).status_code==409
    assert c.post(f"/api/projects/{p}/workflow/run").status_code==200


def test_projects_library_lists_created_workflows(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=create(c)
    response=c.get("/api/projects")
    assert response.status_code==200
    assert response.json()["data"][0]["public_id"]==p


def test_project_assistant_returns_contextual_workflow_guidance(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=create(c)
    c.post(f"/api/projects/{p}/requirements",json={"raw_requirement":"Users can save a shopping list."})
    response=c.post(f"/api/projects/{p}/assistant",json={"message":"What should I do next?"})
    data=response.json()["data"]
    assert response.status_code==200
    assert data["state"]=="REQUIREMENT_CAPTURED"
    assert "Run analysis" in data["reply"]
    friendly=c.post(f"/api/projects/{p}/assistant",json={"message":"cool"}).json()["data"]
    assert "Glad that helped" in friendly["reply"]
    conversation_id=response.json()["data"]["conversation_id"]
    history=c.get(f"/api/projects/{p}/assistant/conversations/{conversation_id}").json()["data"]
    assert [message["role"] for message in history]==["user","assistant"]
    assert c.post(f"/api/projects/{p}/assistant",json={"message":"explain that", "conversation_id":conversation_id}).status_code==200
