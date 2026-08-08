import importlib
from fastapi.testclient import TestClient
from backend.src.orchestration import execute

def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SDLC_DATABASE_PATH", str(tmp_path / "test.db"))
    import backend.src.main as main
    importlib.reload(main); main.init_db()
    test_client = TestClient(main.app)
    assert test_client.post("/api/auth/login", json={"email":"admin@flowpilot.local","password":"flowpilot"}).status_code == 200
    return test_client

def create(c): return c.post("/api/projects",json={"name":"Automated"}).json()["data"]["public_id"]

def test_risk_agent_flags_permission_and_secure_file_upload_controls():
    rbac = execute("risk", {"requirement": "An administrator assigns roles and permission checks protect every action."})
    upload = execute("risk", {"requirement": "A signed-in user uploads a file that must be stored securely."})
    assert any("permission" in item["risk"].lower() and "least privilege" in item["mitigation"].lower() for item in rbac["risks"])
    assert any("secure file upload" in item["risk"].lower() and "malware" in item["mitigation"].lower() for item in upload["risks"])

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
    relationship = data["artifacts"]["traceability"]["relationships"][0]
    assert relationship["business_rule_id"] == "BR-001"
    assert relationship["acceptance_criteria"][0]["test_cases"]
    case = data["artifacts"]["tests"]["test_cases"][0]
    assert {"title", "category", "preconditions", "steps", "expected_result", "coverage", "source_acceptance_criterion", "generated_by"} <= set(case)
    review = c.post(f"/api/projects/{p}/review/run")
    assert review.status_code == 200
    assert review.json()["data"]["generated_by"] == "Review Agent"
    reviewed = c.get(f"/api/projects/{p}").json()["data"]["artifacts"]["ai_review"]
    assert reviewed["version"] == 1

def test_duplicate_and_missing_requirement_are_rejected(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=create(c); payload={"raw_requirement":"Users can export reports to CSV."}
    assert c.post(f"/api/projects/{p}/requirements",json=payload).status_code==201
    assert c.post(f"/api/projects/{p}/requirements",json=payload).status_code==409
    safe_run = c.post(f"/api/projects/{p}/workflow/run")
    assert safe_run.status_code == 200
    assert safe_run.json()["data"]["state"] == "ANALYSIS_COMPLETED"


def test_projects_library_lists_created_workflows(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch); p=create(c)
    response=c.get("/api/projects")
    assert response.status_code==200
    assert response.json()["data"][0]["public_id"]==p
    assert response.json()["data"][0]["updated_at"]
    overview=c.get("/api/workspace/overview").json()["data"]
    assert overview["total_workflows"]==1
    assert overview["active_workflows"]==0


def test_local_login_accepts_demo_account_and_rejects_invalid_credentials(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch)
    logged_in=c.post("/api/auth/login",json={"email":"admin@flowpilot.local","password":"flowpilot"})
    assert logged_in.status_code==200
    assert logged_in.json()["data"]["name"]=="FlowPilot Admin"
    assert c.post("/api/auth/login",json={"email":"admin@flowpilot.local","password":"incorrect"}).status_code==401


def test_invalid_request_uses_the_application_error_envelope(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch)
    response=c.post("/api/projects",json={"name":""})
    payload=response.json()
    assert response.status_code==422
    assert payload["success"] is False
    assert payload["error"]["code"]=="VALIDATION_ERROR"
    assert isinstance(payload["error"]["message"],str)


def test_workspace_apis_require_a_server_side_session(tmp_path,monkeypatch):
    monkeypatch.setenv("SDLC_DATABASE_PATH", str(tmp_path / "test.db"))
    import backend.src.main as main
    importlib.reload(main); main.init_db()
    response = TestClient(main.app).get("/api/projects")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_login_and_workspace_are_served_as_separate_pages(tmp_path,monkeypatch):
    c=client(tmp_path,monkeypatch)
    assert "Sign in to your workspace" in c.get("/").text
    assert c.get("/static/login-motion.js").status_code == 200
    assert "Describe the outcome" in c.get("/app").text


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
    other = create(c)
    isolated = c.post(f"/api/projects/{other}/assistant", json={"message":"What should I do next?", "conversation_id":conversation_id})
    assert isolated.status_code == 404


def test_orchestration_runs_dependencies_in_order_and_persists_history(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch); p = create(c)
    c.post(f"/api/projects/{p}/requirements", json={"raw_requirement":"Users can retry a password reset within five minutes. Given a valid account, when reset is requested, then send one secure link."})
    plan = c.get(f"/api/projects/{p}/orchestration/plan").json()["data"]
    assert [step["agent"] for step in plan["steps"]] == ["requirement", "risk", "review"]
    blocked = c.post(f"/api/projects/{p}/orchestration/review/run")
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "AGENT_DEPENDENCY_REQUIRED"
    result = c.post(f"/api/projects/{p}/orchestration/run-all")
    assert result.status_code == 200
    assert [item["status"] for item in result.json()["data"]["executions"]] == ["completed", "completed", "completed"]
    runs = c.get(f"/api/projects/{p}/orchestration/runs").json()["data"]
    assert {run["agent"] for run in runs} == {"requirement", "risk", "review"}
    assert c.post(f"/api/projects/{p}/orchestration/review/feedback", json={"useful": True}).status_code == 200


def test_project_payload_includes_persisted_agent_findings_for_dashboard(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch); p = create(c)
    c.post(f"/api/projects/{p}/requirements", json={"raw_requirement":"Users can retry a password reset. Given a valid account, when reset is requested, then send one secure link."})
    c.post(f"/api/projects/{p}/orchestration/run-all")
    payload = c.get(f"/api/projects/{p}").json()["data"]
    assert {run["agent"] for run in payload["orchestration_runs"]} == {"requirement", "risk", "review"}
    assert payload["orchestration_runs"][0]["result"] is not None


def test_retry_is_guarded_until_a_workflow_has_failed(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch); p = create(c)
    c.post(f"/api/projects/{p}/requirements", json={"raw_requirement":"Users can save a shopping list."})
    retry = c.post(f"/api/projects/{p}/retry")
    assert retry.status_code == 409
    assert retry.json()["error"]["code"] == "INVALID_STATE_TRANSITION"
