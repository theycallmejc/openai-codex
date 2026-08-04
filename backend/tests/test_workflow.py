import importlib
from fastapi.testclient import TestClient

def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SDLC_DATABASE_PATH", str(tmp_path / "test.db"))
    import backend.src.main as main
    importlib.reload(main); main.init_db()
    return TestClient(main.app)

def project(c): return c.post("/api/projects", json={"name":"FlowPilot"}).json()["data"]["public_id"]
def requirement(c,p,text="Users can save a shopping list. Users can rename a shopping list."):
    return c.post(f"/api/projects/{p}/requirements",json={"raw_requirement":text})
def brd(c,p): return c.post(f"/api/projects/{p}/brd/generate")

def test_successful_approved_flow_and_audit(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=project(c); assert requirement(c,p).json()["data"]["state"]=="REQUIREMENT_CAPTURED"
    assert brd(c,p).json()["data"]["state"]=="BRD_AWAITING_APPROVAL"
    assert c.post(f"/api/projects/{p}/brd/approve",json={"reviewer":"Ava"}).json()["data"]["state"]=="BRD_APPROVED"
    assert c.post(f"/api/projects/{p}/backlog/generate").json()["data"]["state"]=="BACKLOG_AWAITING_APPROVAL"
    assert c.post(f"/api/projects/{p}/backlog/approve",json={"reviewer":"Ava"}).json()["data"]["state"]=="BACKLOG_APPROVED"
    assert c.post(f"/api/projects/{p}/tests/generate").json()["data"]["state"]=="COMPLETED"
    data=c.get(f"/api/projects/{p}").json()["data"]; assert data["artifacts"]["qa_handoff"]["approval_state"]=="PENDING"
    assert data["audit_events"] and all(x["event_id"] for x in data["audit_events"])

def test_brd_rejection_reason_and_revision_history(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=project(c); requirement(c,p); brd(c,p)
    assert c.post(f"/api/projects/{p}/brd/reject",json={"reviewer":"Ava"}).status_code==422
    assert c.post(f"/api/projects/{p}/brd/reject",json={"reviewer":"Ava","reason":"Scope unclear"}).json()["data"]["state"]=="BRD_REJECTED"
    assert brd(c,p).json()["data"]["artifact_version"]==2
    data=c.get(f"/api/projects/{p}").json()["data"]; assert len([x for x in data["artifact_history"] if x["artifact_type"]=="brd"])==2

def test_blocked_and_repeated_decisions_are_conflicts(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=project(c); requirement(c,p)
    assert c.post(f"/api/projects/{p}/backlog/generate").status_code==409
    brd(c,p); c.post(f"/api/projects/{p}/brd/approve",json={"reviewer":"Ava"})
    assert c.post(f"/api/projects/{p}/brd/approve",json={"reviewer":"Ava"}).status_code==409
    assert c.post(f"/api/projects/{p}/tests/generate").status_code==409

def test_corrected_requirement_preserves_prior_artifacts(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=project(c); requirement(c,p); brd(c,p)
    requirement(c,p,"Users can export reports to CSV.")
    data=c.get(f"/api/projects/{p}").json()["data"]; assert data["state"]=="REQUIREMENT_CAPTURED"
    assert any(x["artifact_type"]=="brd" for x in data["artifact_history"])
