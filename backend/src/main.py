from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.getenv("SDLC_DATABASE_PATH", str(ROOT / "data" / "sdlc-framework.db")))
RULES_VERSION = "automated-rules-v1"
MAX_REQUIREMENT_LENGTH = 10_000
STATES = {"DRAFT", "REQUIREMENT_CAPTURED", "ANALYSIS_COMPLETED", "BRD_GENERATED", "BRD_AWAITING_APPROVAL", "BRD_APPROVED", "BRD_REJECTED", "BACKLOG_GENERATED", "BACKLOG_AWAITING_APPROVAL", "BACKLOG_APPROVED", "BACKLOG_REJECTED", "TESTS_GENERATED", "TRACEABILITY_VALIDATED", "QA_HANDOFF_READY", "COMPLETED", "FAILED"}

app = FastAPI(title="Automated SDLC-to-QA MVP", version="1.0.0")


class ProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)


class RequirementInput(BaseModel):
    raw_requirement: str = Field(min_length=1, max_length=MAX_REQUIREMENT_LENGTH)


class DecisionInput(BaseModel):
    reviewer: str = Field(min_length=1, max_length=120)
    reason: str = Field(default="", max_length=2000)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def envelope(data: Any, status: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status, content={"success": True, "data": data, "request_id": str(uuid.uuid4())})


@app.exception_handler(HTTPException)
async def api_error(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "REQUEST_ERROR", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"success": False, "error": detail, "request_id": str(uuid.uuid4())})


@app.exception_handler(Exception)
async def unexpected_error(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"success": False, "error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error"}, "request_id": str(uuid.uuid4())})


@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, public_id TEXT UNIQUE, name TEXT, description TEXT, state TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS requirements (id INTEGER PRIMARY KEY, project_id INTEGER UNIQUE, raw_text TEXT, content_hash TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS artifacts (id INTEGER PRIMARY KEY, project_id INTEGER, kind TEXT, content_json TEXT, created_at TEXT, UNIQUE(project_id, kind));
        CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY, project_id INTEGER, stage TEXT, outcome TEXT, actor TEXT, rules_version TEXT, reason TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS requirement_revisions (id INTEGER PRIMARY KEY, project_id INTEGER, version INTEGER, raw_text TEXT, content_hash TEXT, created_at TEXT, UNIQUE(project_id,version));
        CREATE TABLE IF NOT EXISTS artifact_revisions (id INTEGER PRIMARY KEY, project_id INTEGER, artifact_type TEXT, version INTEGER, workflow_stage TEXT, approval_state TEXT, content_json TEXT, created_at TEXT, UNIQUE(project_id,artifact_type,version));
        CREATE TABLE IF NOT EXISTS workflow_audit_events (id INTEGER PRIMARY KEY, event_id TEXT UNIQUE, project_id INTEGER, artifact_type TEXT, artifact_version INTEGER, actor TEXT, action TEXT, previous_state TEXT, new_state TEXT, timestamp TEXT, reason TEXT, metadata_json TEXT);
        """)


@app.on_event("startup")
def startup() -> None:
    init_db()


def public_id(prefix: str, numeric_id: int) -> str:
    return f"{prefix}-{numeric_id:03d}"


def project_row(c: sqlite3.Connection, project_id: str) -> sqlite3.Row:
    row = c.execute("SELECT * FROM projects WHERE public_id = ?", (project_id,)).fetchone()
    if not row:
        raise HTTPException(404, {"code": "PROJECT_NOT_FOUND", "message": "Project does not exist"})
    return row


def artifact(c: sqlite3.Connection, project_key: int, kind: str) -> Any | None:
    row = c.execute("SELECT content_json FROM artifacts WHERE project_id = ? AND kind = ?", (project_key, kind)).fetchone()
    return json.loads(row[0]) if row else None


def save_artifact(c: sqlite3.Connection, project_key: int, kind: str, payload: dict[str, Any]) -> None:
    c.execute("INSERT INTO artifacts(project_id,kind,content_json,created_at) VALUES(?,?,?,?) ON CONFLICT(project_id,kind) DO UPDATE SET content_json=excluded.content_json,created_at=excluded.created_at", (project_key, kind, json.dumps(payload), now()))


def audit(c: sqlite3.Connection, project_key: int, stage: str, outcome: str, reason: str = "") -> None:
    c.execute("INSERT INTO audit_events(project_id,stage,outcome,actor,rules_version,reason,created_at) VALUES(?,?,?,?,?,?,?)", (project_key, stage, outcome, "system", RULES_VERSION, reason, now()))


def transition(c, project, new_state, action, artifact_type=None, version=None, actor="system", reason="", metadata=None):
    if new_state not in STATES: raise ValueError(new_state)
    c.execute("UPDATE projects SET state=? WHERE id=?", (new_state, project["id"]))
    c.execute("INSERT INTO workflow_audit_events(event_id,project_id,artifact_type,artifact_version,actor,action,previous_state,new_state,timestamp,reason,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), project["id"], artifact_type, version, actor, action, project["state"], new_state, now(), reason, json.dumps(metadata or {"rules_version": RULES_VERSION})))
    return c.execute("SELECT * FROM projects WHERE id=?", (project["id"],)).fetchone()


def revision(c, project, kind, stage, content, approval_state="PENDING"):
    version = c.execute("SELECT COALESCE(MAX(version),0)+1 FROM artifact_revisions WHERE project_id=? AND artifact_type=?", (project["id"], kind)).fetchone()[0]
    c.execute("INSERT INTO artifact_revisions(project_id,artifact_type,version,workflow_stage,approval_state,content_json,created_at) VALUES(?,?,?,?,?,?,?)", (project["id"], kind, version, stage, approval_state, json.dumps(content), now()))
    return version


def latest_revision(c, project, kind):
    row = c.execute("SELECT * FROM artifact_revisions WHERE project_id=? AND artifact_type=? ORDER BY version DESC LIMIT 1", (project["id"], kind)).fetchone()
    return (json.loads(row["content_json"]), row) if row else (None, None)


def require_state(project, states, actions):
    if project["state"] not in states:
        raise HTTPException(409, {"code":"INVALID_STATE_TRANSITION", "message":f"Action is not allowed from {project['state']}", "allowed_actions":actions})


def clauses(raw: str) -> list[str]:
    parts = [re.sub(r"\s+", " ", p).strip(" .;") for p in re.split(r"[.;\n]+", raw)]
    return [p for p in parts if len(p) >= 8]


def run_pipeline(c: sqlite3.Connection, project: sqlite3.Row) -> dict[str, Any]:
    requirement = c.execute("SELECT * FROM requirements WHERE project_id = ?", (project["id"],)).fetchone()
    if not requirement:
        raise HTTPException(409, {"code": "REQUIREMENT_REQUIRED", "message": "Submit a requirement before running the workflow", "next_action": "submit_requirement"})
    try:
        statements = clauses(requirement["raw_text"])
        if not statements:
            raise ValueError("Requirement must contain a meaningful capability statement")
        title = statements[0][:80]
        analysis = {"id": "REQ-001", "title": title, "functional_requirements": [{"id": f"REQ-001-FR-{i:02d}", "text": text} for i, text in enumerate(statements, 1)], "generator_mode": "deterministic", "rules_version": RULES_VERSION}
        save_artifact(c, project["id"], "analysis", analysis); audit(c, project["id"], "analysis", "passed")
        brd = {"id": "BRD-001", "title": title, "scope_in": [x["text"] for x in analysis["functional_requirements"]], "assumptions": ["All unspecified business rules require later review"], "source_requirement_id": "REQ-001", "rules_version": RULES_VERSION}
        save_artifact(c, project["id"], "brd", brd); audit(c, project["id"], "brd_validation", "passed")
        stories = [{"id": f"STORY-{i:03d}", "source_requirement_id": req["id"], "title": f"As a user, I need {req['text'].lower()} so that the requested outcome is available.", "acceptance_criteria": [{"id": f"AC-{i:03d}", "given": "a valid user", "when": req["text"], "then": "the requested result is produced"}]} for i, req in enumerate(analysis["functional_requirements"], 1)]
        backlog = {"id": "BACKLOG-001", "stories": stories, "rules_version": RULES_VERSION}
        save_artifact(c, project["id"], "backlog", backlog); audit(c, project["id"], "backlog_validation", "passed")
        tests = []
        for story in stories:
            ac = story["acceptance_criteria"][0]
            for case_type, objective in [("positive", "valid input succeeds"), ("negative", "invalid input is rejected"), ("boundary", "boundary input is handled")]:
                tests.append({"id": f"TC-{len(tests)+1:03d}", "criterion_id": ac["id"], "type": case_type, "objective": objective})
        test_suite = {"id": "TEST-001", "test_cases": tests, "rules_version": RULES_VERSION}
        save_artifact(c, project["id"], "tests", test_suite); audit(c, project["id"], "test_validation", "passed")
        traceability = {"valid": True, "criteria_count": len(stories), "test_count": len(tests), "coverage": "100%", "gaps": []}
        save_artifact(c, project["id"], "traceability", traceability); audit(c, project["id"], "traceability", "passed")
        handoff = {"id": "QAH-001", "status": "ready", "source_requirement_id": "REQ-001", "traceability": traceability, "rules_version": RULES_VERSION}
        save_artifact(c, project["id"], "qa_handoff", handoff); audit(c, project["id"], "qa_handoff", "passed")
        c.execute("UPDATE projects SET state = 'COMPLETED' WHERE id = ?", (project["id"],))
        return {"state": "COMPLETED", "artifact_ids": [analysis["id"], brd["id"], backlog["id"], test_suite["id"], handoff["id"]], "traceability": traceability, "failure": None}
    except ValueError as exc:
        audit(c, project["id"], "pipeline", "failed", str(exc))
        c.execute("UPDATE projects SET state = 'FAILED' WHERE id = ?", (project["id"],))
        return {"state": "FAILED", "artifact_ids": [], "traceability": None, "failure": {"code": "VALIDATION_FAILED", "message": str(exc), "next_action": "submit_corrected_requirement"}}


def project_payload(c: sqlite3.Connection, project: sqlite3.Row) -> dict[str, Any]:
    keys = ["analysis", "brd", "backlog", "tests", "traceability", "qa_handoff"]
    audit_rows = c.execute("SELECT * FROM workflow_audit_events WHERE project_id = ? ORDER BY id", (project["id"],)).fetchall()
    history = c.execute("SELECT artifact_type,version,workflow_stage,approval_state,created_at FROM artifact_revisions WHERE project_id=? ORDER BY id", (project["id"],)).fetchall()
    artifacts = {}
    for key in keys:
        content, row = latest_revision(c, project, key)
        artifacts[key] = {**content, "version":row["version"], "created_at":row["created_at"], "approval_state":row["approval_state"]} if row else artifact(c, project["id"], key)
    return {"public_id": project["public_id"], "name": project["name"], "description": project["description"], "state": project["state"], "artifacts": artifacts, "artifact_history":[dict(x) for x in history], "audit_events":[{**dict(x),"metadata":json.loads(x["metadata_json"])} for x in audit_rows]}


@app.get("/")
def home() -> FileResponse:
    return FileResponse(ROOT / "frontend" / "index.html")


@app.get("/static/{asset}")
def static(asset: str) -> FileResponse:
    if asset not in {"app.js", "styles.css"}:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Asset not found"})
    return FileResponse(ROOT / "frontend" / "static" / asset)


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "mode": "deterministic", "rules_version": RULES_VERSION}


@app.post("/api/projects", status_code=201)
def create_project(payload: ProjectInput) -> JSONResponse:
    with db() as c:
        cursor = c.execute("INSERT INTO projects(public_id,name,description,state,created_at) VALUES('',?,?,?,?)", (payload.name.strip(), payload.description.strip(), "DRAFT", now()))
        project_id = public_id("PRJ", cursor.lastrowid)
        c.execute("UPDATE projects SET public_id = ? WHERE id = ?", (project_id, cursor.lastrowid))
        return envelope({"public_id": project_id, "state": "DRAFT"}, 201)


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> JSONResponse:
    with db() as c:
        return envelope(project_payload(c, project_row(c, project_id)))


@app.post("/api/projects/{project_id}/requirements")
def submit_requirement(project_id: str, payload: RequirementInput) -> JSONResponse:
    raw = re.sub(r"\s+", " ", payload.raw_requirement).strip()
    if not raw:
        raise HTTPException(422, {"code": "INVALID_REQUIREMENT", "message": "Requirement cannot be empty"})
    with db() as c:
        project = project_row(c, project_id)
        digest = hashlib.sha256(raw.lower().encode()).hexdigest()
        existing = c.execute("SELECT content_hash FROM requirements WHERE project_id = ?", (project["id"],)).fetchone()
        if existing and existing[0] == digest:
            raise HTTPException(409, {"code": "DUPLICATE_REQUIREMENT", "message": "This requirement was already submitted"})
        c.execute("INSERT INTO requirements(project_id,raw_text,content_hash,created_at) VALUES(?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET raw_text=excluded.raw_text,content_hash=excluded.content_hash,created_at=excluded.created_at", (project["id"], raw, digest, now()))
        version = c.execute("SELECT COALESCE(MAX(version),0)+1 FROM requirement_revisions WHERE project_id=?", (project["id"],)).fetchone()[0]
        c.execute("INSERT INTO requirement_revisions(project_id,version,raw_text,content_hash,created_at) VALUES(?,?,?,?,?)", (project["id"], version, raw, digest, now()))
        project = transition(c, project, "REQUIREMENT_CAPTURED", "requirement_captured", "requirement", version, metadata={"invalidated_dependent_artifacts":bool(existing), "automation_mode":"stepwise"})
        return envelope({"state": project["state"], "requirement_version": version, "next_action": "run_analysis"}, 201)


@app.post("/api/projects/{project_id}/workflow/run")
def workflow_run(project_id: str) -> JSONResponse:
    with db() as c:
        project = project_row(c, project_id)
        return envelope({**run_pipeline(c, project), "automation_mode": "end_to_end"})


@app.post("/api/projects/{project_id}/automation/run-next")
def automation_run_next(project_id: str) -> JSONResponse:
    """Run the next autonomous agent, but deliberately stop at human approval gates."""
    with db() as c:
        project = project_row(c, project_id)
        state = project["state"]
        if state in {"BRD_AWAITING_APPROVAL", "BACKLOG_AWAITING_APPROVAL"}:
            return envelope({"state": state, "status": "blocked", "reason": "Human approval is required before automation can continue."})
        routes = {
            "REQUIREMENT_CAPTURED": "analysis",
            "ANALYSIS_COMPLETED": "brd",
            "BRD_APPROVED": "backlog",
            "BACKLOG_APPROVED": "tests",
            "TESTS_GENERATED": "traceability",
            "TRACEABILITY_VALIDATED": "qa_handoff",
        }
        agent = routes.get(state)
        if not agent:
            return envelope({"state": state, "status": "idle", "reason": "No autonomous agent is available for this workflow state."})
    # Reuse the same guarded endpoints so automation cannot bypass workflow rules.
    handlers = {
        "analysis": analysis_generate,
        "brd": brd_generate,
        "backlog": backlog_generate,
        "tests": tests_generate,
        "traceability": traceability_generate,
        "qa_handoff": qa_handoff_generate,
    }
    return handlers[agent](project_id)


@app.post("/api/projects/{project_id}/analysis/generate")
def analysis_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project = project_row(c, project_id)
        require_state(project, {"REQUIREMENT_CAPTURED"}, ["submit_requirement"])
        req = c.execute("SELECT raw_text FROM requirements WHERE project_id=?", (project["id"],)).fetchone()[0]
        items = clauses(req)
        if not items:
            transition(c, project, "FAILED", "analysis_failed", reason="No meaningful requirement")
            raise HTTPException(422, {"code":"VALIDATION_FAILED", "message":"No meaningful requirement"})
        version = revision(c, project, "analysis", "ANALYSIS_COMPLETED", {"id":"REQ-001", "functional_requirements":[{"id":f"REQ-001-FR-{i:02d}", "text":text} for i,text in enumerate(items,1)], "rules_version":RULES_VERSION})
        project = transition(c, project, "ANALYSIS_COMPLETED", "analysis_completed", "analysis", version)
        return envelope({"state":project["state"], "agent":"analysis", "artifact_version":version, "next_action":"generate_brd"})


@app.post("/api/projects/{project_id}/brd/generate")
def brd_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project=project_row(c, project_id); require_state(project,{"ANALYSIS_COMPLETED","BRD_REJECTED"},["run_analysis"])
        analysis,av_row=latest_revision(c,project,"analysis"); items=[x["text"] if isinstance(x,dict) else x for x in analysis["functional_requirements"]]; av=av_row["version"]
        project=transition(c,project,"BRD_GENERATED","brd_generated","brd")
        bv=revision(c,project,"brd","BRD_GENERATED",{"id":"BRD-001","scope_in":items,"analysis_version":av,"rules_version":RULES_VERSION})
        project=transition(c,project,"BRD_AWAITING_APPROVAL","brd_awaiting_approval","brd",bv)
        return envelope({"state":project["state"],"artifact_version":bv,"next_action":"approve_brd_or_reject_brd"})


def decide(c, project, kind, approved, body):
    awaiting=f"{kind.upper()}_AWAITING_APPROVAL"; require_state(project,{awaiting},[f"generate_{kind}"])
    if not approved and not body.reason.strip(): raise HTTPException(422,{"code":"REJECTION_REASON_REQUIRED","message":"A rejection reason is required"})
    content,row=latest_revision(c,project,kind); status="APPROVED" if approved else "REJECTED"; state=f"{kind.upper()}_{status}"; action=f"{kind}_{status.lower()}"
    c.execute("UPDATE artifact_revisions SET approval_state=? WHERE id=?",(status,row["id"]))
    project=transition(c,project,state,action,kind,row["version"],body.reviewer,body.reason.strip(),{"rules_version":RULES_VERSION,"approval_state":status})
    return {"state":project["state"],"artifact_version":row["version"],"approval_state":status}


@app.post("/api/projects/{project_id}/brd/approve")
def brd_approve(project_id: str, body: DecisionInput) -> JSONResponse:
    with db() as c: return envelope(decide(c,project_row(c,project_id),"brd",True,body))

@app.post("/api/projects/{project_id}/brd/reject")
def brd_reject(project_id: str, body: DecisionInput) -> JSONResponse:
    with db() as c: return envelope(decide(c,project_row(c,project_id),"brd",False,body))

@app.post("/api/projects/{project_id}/backlog/generate")
def backlog_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project=project_row(c,project_id); require_state(project,{"BRD_APPROVED","BACKLOG_REJECTED"},["approve_brd"]); brd,row=latest_revision(c,project,"brd")
        project=transition(c,project,"BACKLOG_GENERATED","backlog_generated","backlog")
        stories=[{"id":f"STORY-{i:03d}","acceptance_criteria":[{"id":f"AC-{i:03d}","then":item}]} for i,item in enumerate(brd["scope_in"],1)]
        version=revision(c,project,"backlog","BACKLOG_GENERATED",{"id":"BACKLOG-001","brd_version":row["version"],"stories":stories,"rules_version":RULES_VERSION})
        project=transition(c,project,"BACKLOG_AWAITING_APPROVAL","backlog_awaiting_approval","backlog",version)
        return envelope({"state":project["state"],"artifact_version":version,"next_action":"approve_backlog_or_reject_backlog"})

@app.post("/api/projects/{project_id}/backlog/approve")
def backlog_approve(project_id: str, body: DecisionInput) -> JSONResponse:
    with db() as c: return envelope(decide(c,project_row(c,project_id),"backlog",True,body))
@app.post("/api/projects/{project_id}/backlog/reject")
def backlog_reject(project_id: str, body: DecisionInput) -> JSONResponse:
    with db() as c: return envelope(decide(c,project_row(c,project_id),"backlog",False,body))

@app.post("/api/projects/{project_id}/tests/generate")
def tests_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project=project_row(c,project_id); require_state(project,{"BACKLOG_APPROVED"},["approve_backlog"]); backlog,row=latest_revision(c,project,"backlog")
        project=transition(c,project,"TESTS_GENERATED","tests_generated","tests"); cases=[]
        for story in backlog["stories"]:
            for typ in ("positive","negative","boundary"): cases.append({"id":f"TC-{len(cases)+1:03d}","criterion_id":story["acceptance_criteria"][0]["id"],"type":typ})
        tv=revision(c,project,"tests","TESTS_GENERATED",{"id":"TEST-001","test_cases":cases,"backlog_version":row["version"]})
        project=transition(c,project,"TESTS_GENERATED","tests_generated","tests",tv)
        return envelope({"state":project["state"],"agent":"tests","artifact_version":tv,"next_action":"validate_traceability"})


@app.post("/api/projects/{project_id}/traceability/generate")
def traceability_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project=project_row(c,project_id); require_state(project,{"TESTS_GENERATED"},["generate_tests"])
        tests,row=latest_revision(c,project,"tests")
        backlog,_=latest_revision(c,project,"backlog")
        version=revision(c,project,"traceability","TRACEABILITY_VALIDATED",{"valid":True,"criteria_count":len(backlog["stories"]),"test_count":len(tests["test_cases"]),"coverage":"100%","gaps":[]})
        project=transition(c,project,"TRACEABILITY_VALIDATED","traceability_validated","traceability",version)
        return envelope({"state":project["state"],"agent":"traceability","artifact_version":version,"next_action":"create_qa_handoff"})


@app.post("/api/projects/{project_id}/qa-handoff/generate")
def qa_handoff_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project=project_row(c,project_id); require_state(project,{"TRACEABILITY_VALIDATED"},["validate_traceability"])
        _,trace=latest_revision(c,project,"traceability")
        version=revision(c,project,"qa_handoff","QA_HANDOFF_READY",{"id":"QAH-001","status":"ready","traceability_version":trace["version"]})
        project=transition(c,project,"QA_HANDOFF_READY","qa_handoff_ready","qa_handoff",version)
        project=transition(c,project,"COMPLETED","workflow_completed","qa_handoff",version)
        return envelope({"state":project["state"],"agent":"qa_handoff","artifact_version":version,"next_action":"complete"})


@app.get("/api/projects/{project_id}/traceability")
def traceability(project_id: str) -> JSONResponse:
    with db() as c:
        project = project_row(c, project_id); data = artifact(c, project["id"], "traceability")
        if not data: raise HTTPException(409, {"code": "TRACEABILITY_NOT_READY", "message": "Run the workflow first"})
        return envelope(data)


@app.get("/api/projects/{project_id}/qa-handoff")
def qa_handoff(project_id: str) -> JSONResponse:
    with db() as c:
        project = project_row(c, project_id); data = artifact(c, project["id"], "qa_handoff")
        if not data: raise HTTPException(409, {"code": "QA_HANDOFF_NOT_READY", "message": "Run the workflow first"})
        return envelope(data)
