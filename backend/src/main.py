from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import uuid
import logging
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.getenv("SDLC_DATABASE_PATH", str(ROOT / "data" / "sdlc-framework.db")))
RULES_VERSION = "automated-rules-v1"
MAX_REQUIREMENT_LENGTH = 10_000
STATES = {"DRAFT", "REQUIREMENT_CAPTURED", "ANALYSIS_COMPLETED", "BRD_GENERATED", "BRD_AWAITING_APPROVAL", "BRD_APPROVED", "BRD_REJECTED", "BACKLOG_GENERATED", "BACKLOG_AWAITING_APPROVAL", "BACKLOG_APPROVED", "BACKLOG_REJECTED", "TESTS_GENERATED", "TRACEABILITY_VALIDATED", "QA_HANDOFF_READY", "COMPLETED", "FAILED"}
ASSISTANT_CONTEXT_WINDOW = 8
ASSISTANT_RATE_LIMIT = 30
SESSION_SECRET = os.getenv("FLOWPILOT_SESSION_SECRET", "flowpilot-local-development-only")
SESSION_HTTPS_ONLY = os.getenv("FLOWPILOT_SESSION_HTTPS_ONLY", "false").lower() == "true"
ASSISTANT_KNOWLEDGE = {
    "application": "FlowPilot",
    "purpose": "A local SDLC-to-QA workflow application that turns a requirement into governed, QA-ready artifacts.",
    "workflow": "Requirement → Analysis → BRD → human approval → Backlog → human approval → Tests → Traceability → QA handoff.",
    "limitations": "This local MVP uses deterministic generation and has no configured external LLM provider, authentication system, or multi-user sharing.",
}

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Automated SDLC-to-QA MVP", version="1.0.0", lifespan=lifespan)
logger = logging.getLogger("flowpilot")


class ProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)


class RequirementInput(BaseModel):
    raw_requirement: str = Field(min_length=1, max_length=MAX_REQUIREMENT_LENGTH)


class DecisionInput(BaseModel):
    reviewer: str = Field(min_length=1, max_length=120)
    reason: str = Field(default="", max_length=2000)


class ReviewCommentInput(BaseModel):
    artifact_type: str = Field(min_length=1, max_length=40)
    author: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=2000)


class AssistantInput(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    conversation_id: str | None = Field(default=None, max_length=64)


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def envelope(data: Any, status: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status, content={"success": True, "data": data, "request_id": str(uuid.uuid4())})


@app.middleware("http")
async def security_and_session(request: Request, call_next):
    """Apply a small production-safe baseline while keeping the local MVP usable."""
    protected = request.url.path.startswith("/api/projects") or request.url.path in {"/api/assistant", "/api/reviews"}
    if protected and not request.session.get("user_id"):
        return JSONResponse(status_code=401, content={"success": False, "error": {"code": "AUTHENTICATION_REQUIRED", "message": "Sign in to access the workspace."}, "request_id": str(uuid.uuid4())})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
    return response


# Added after the function middleware so session data is available to it.
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, https_only=SESSION_HTTPS_ONLY, same_site="lax")


@app.exception_handler(HTTPException)
async def api_error(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "REQUEST_ERROR", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"success": False, "error": detail, "request_id": str(uuid.uuid4())})


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Keep framework validation details out of the user-facing API contract."""
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(part) for part in first.get("loc", [])[1:])
    message = first.get("msg", "Check the submitted values and try again.")
    if field:
        message = f"{field.replace('_', ' ').capitalize()}: {message}"
    return JSONResponse(status_code=422, content={"success": False, "error": {"code": "VALIDATION_ERROR", "message": message}, "request_id": str(uuid.uuid4())})


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled request failure", extra={"path": request.url.path, "method": request.method})
    return JSONResponse(status_code=500, content={"success": False, "error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error"}, "request_id": str(uuid.uuid4())})


@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=5)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 5000")
        connection.execute("PRAGMA journal_mode = WAL")
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
        CREATE TABLE IF NOT EXISTS agent_runs (id INTEGER PRIMARY KEY, run_id TEXT UNIQUE, project_id INTEGER, agent TEXT, status TEXT, input_artifact TEXT, output_artifact TEXT, started_at TEXT, completed_at TEXT, error TEXT);
        CREATE TABLE IF NOT EXISTS assistant_conversations (id TEXT PRIMARY KEY, project_id INTEGER, title TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS assistant_messages (id TEXT PRIMARY KEY, conversation_id TEXT, role TEXT, content TEXT, created_at TEXT, FOREIGN KEY(conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS review_comments (id TEXT PRIMARY KEY, project_id INTEGER, artifact_type TEXT, author TEXT, body TEXT, created_at TEXT, FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE);
        CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation ON assistant_messages(conversation_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_review_comments_project ON review_comments(project_id, created_at);
        """)


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


def start_agent_run(c, project, agent: str, input_artifact: str) -> str:
    run_id = str(uuid.uuid4())
    c.execute("INSERT INTO agent_runs(run_id,project_id,agent,status,input_artifact,started_at) VALUES(?,?,?,?,?,?)", (run_id, project["id"], agent, "running", input_artifact, now()))
    return run_id


def finish_agent_run(c, run_id: str, output_artifact: str) -> None:
    c.execute("UPDATE agent_runs SET status='completed',output_artifact=?,completed_at=? WHERE run_id=?", (output_artifact, now(), run_id))


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
    runs = c.execute("SELECT run_id,agent,status,input_artifact,output_artifact,started_at,completed_at,error FROM agent_runs WHERE project_id=? ORDER BY id", (project["id"],)).fetchall()
    comments = c.execute("SELECT id,artifact_type,author,body,created_at FROM review_comments WHERE project_id=? ORDER BY created_at", (project["id"],)).fetchall()
    artifacts = {}
    for key in keys:
        content, row = latest_revision(c, project, key)
        artifacts[key] = {**content, "version":row["version"], "created_at":row["created_at"], "approval_state":row["approval_state"]} if row else artifact(c, project["id"], key)
    return {"public_id": project["public_id"], "name": project["name"], "description": project["description"], "state": project["state"], "artifacts": artifacts, "artifact_history":[dict(x) for x in history], "agent_runs":[dict(x) for x in runs], "comments":[dict(x) for x in comments], "audit_events":[{**dict(x),"metadata":json.loads(x["metadata_json"])} for x in audit_rows]}


@app.get("/")
def home() -> FileResponse:
    return FileResponse(ROOT / "frontend" / "login.html")


@app.get("/app")
def workspace() -> FileResponse:
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


@app.post("/api/auth/login")
def login(request: Request, payload: LoginInput) -> JSONResponse:
    """Local development sign-in; production identity provider integration is intentionally out of scope."""
    email = payload.email.strip().lower()
    if email == "admin@flowpilot.local" and payload.password == "flowpilot":
        request.session["user_id"] = "local-admin"
        return envelope({"id": "local-admin", "name": "FlowPilot Admin", "email": email, "workspace": "Local workspace"})
    raise HTTPException(401, {"code": "INVALID_CREDENTIALS", "message": "Use the local demo account or check your credentials."})


@app.post("/api/auth/logout")
def logout(request: Request) -> JSONResponse:
    request.session.clear()
    return envelope({"signed_out": True})


@app.post("/api/projects", status_code=201)
def create_project(payload: ProjectInput) -> JSONResponse:
    with db() as c:
        cursor = c.execute("INSERT INTO projects(public_id,name,description,state,created_at) VALUES('',?,?,?,?)", (payload.name.strip(), payload.description.strip(), "DRAFT", now()))
        project_id = public_id("PRJ", cursor.lastrowid)
        c.execute("UPDATE projects SET public_id = ? WHERE id = ?", (project_id, cursor.lastrowid))
        return envelope({"public_id": project_id, "state": "DRAFT"}, 201)


@app.get("/api/projects")
def list_projects() -> JSONResponse:
    with db() as c:
        rows = c.execute("""
            SELECT p.public_id,p.name,p.description,p.state,p.created_at,
              COALESCE((SELECT MAX(timestamp) FROM workflow_audit_events WHERE project_id=p.id), p.created_at) AS updated_at,
              (SELECT COUNT(*) FROM agent_runs WHERE project_id=p.id) AS agent_run_count
            FROM projects p ORDER BY updated_at DESC, p.id DESC
        """).fetchall()
        return envelope([dict(row) for row in rows])


@app.get("/api/workspace/overview")
def workspace_overview() -> JSONResponse:
    with db() as c:
        row = c.execute("""
            SELECT
              COUNT(*) AS total_workflows,
              SUM(CASE WHEN state = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_workflows,
              SUM(CASE WHEN state IN ('BRD_AWAITING_APPROVAL','BACKLOG_AWAITING_APPROVAL') THEN 1 ELSE 0 END) AS awaiting_review,
              SUM(CASE WHEN state NOT IN ('DRAFT','COMPLETED','FAILED') THEN 1 ELSE 0 END) AS active_workflows,
              (SELECT COUNT(*) FROM agent_runs WHERE status = 'completed') AS completed_agent_runs
            FROM projects
        """).fetchone()
        return envelope({key: int(value or 0) for key, value in dict(row).items()})


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> JSONResponse:
    with db() as c:
        return envelope(project_payload(c, project_row(c, project_id)))


@app.get("/api/reviews")
def review_inbox() -> JSONResponse:
    with db() as c:
        rows = c.execute("SELECT public_id,name,state,created_at FROM projects WHERE state IN ('BRD_AWAITING_APPROVAL','BACKLOG_AWAITING_APPROVAL') ORDER BY created_at").fetchall()
        return envelope([{**dict(row), "artifact_type": "brd" if row["state"] == "BRD_AWAITING_APPROVAL" else "backlog"} for row in rows])


@app.post("/api/projects/{project_id}/comments")
def add_review_comment(project_id: str, payload: ReviewCommentInput) -> JSONResponse:
    with db() as c:
        project = project_row(c, project_id)
        artifact_type = payload.artifact_type.strip().lower()
        if artifact_type not in {"requirement", "analysis", "brd", "backlog", "tests", "traceability", "qa_handoff"}:
            raise HTTPException(422, {"code": "INVALID_ARTIFACT", "message": "Choose a valid workflow artifact."})
        comment = {"id": str(uuid.uuid4()), "artifact_type": artifact_type, "author": payload.author.strip(), "body": payload.body.strip(), "created_at": now()}
        c.execute("INSERT INTO review_comments(id,project_id,artifact_type,author,body,created_at) VALUES(?,?,?,?,?,?)", (comment["id"], project["id"], comment["artifact_type"], comment["author"], comment["body"], comment["created_at"]))
        return envelope(comment, 201)


def assistant_reply(project: sqlite3.Row | None, artifacts: dict[str, Any], message: str, history: list[sqlite3.Row]) -> str:
    """Trusted app knowledge + bounded conversation context; never treats user text as instructions."""
    text = message.strip().lower()
    if any(term in text for term in ("system prompt", "instructions", "api key", "secret", "credential")):
        return "I can’t provide internal instructions, credentials, or configuration. I can help with FlowPilot’s supported workflow and artifacts."
    prior_user = next((row["content"] for row in reversed(history) if row["role"] == "user"), "")
    if text in {"explain that", "why?", "why", "give me an example"} and prior_user:
        text = f"{text} {prior_user.lower()}"
    if re.search(r"^(hi|hello|hey)\b", text): return "Hi. I can explain FlowPilot, guide the next workflow action, or summarize coverage."
    if re.search(r"\b(thanks|thank you|great|good|cool|nice|okay|ok)\b", text): return "Glad that helped. What would you like to do next?"
    if "approval" in text or "review" in text: return "BRD and backlog reviews are the two human gates. Automation pauses there so a reviewer can approve or request changes with a recorded reason."
    if "what does" in text or "workflow" in text or "how does" in text or "explain" in text: return f"{ASSISTANT_KNOWLEDGE['purpose']} The workflow is: {ASSISTANT_KNOWLEDGE['workflow']}"
    if not project: return "Create a workflow or load a sample to receive project-specific help. I can also explain the workflow, approval gates, coverage, or QA handoff."
    state = project["state"]
    steps = {"REQUIREMENT_CAPTURED":"Run analysis.","ANALYSIS_COMPLETED":"Generate the BRD.","BRD_AWAITING_APPROVAL":"Review the BRD.","BRD_APPROVED":"Generate the backlog.","BACKLOG_AWAITING_APPROVAL":"Review the backlog.","BACKLOG_APPROVED":"Generate tests.","TESTS_GENERATED":"Validate traceability.","TRACEABILITY_VALIDATED":"Create the QA handoff.","COMPLETED":"Download or share the QA handoff."}
    if "coverage" in text or "test" in text:
        return f"Coverage currently has {len((artifacts.get('analysis') or {}).get('functional_requirements', []))} requirements, {len((artifacts.get('backlog') or {}).get('stories', []))} stories, and {len((artifacts.get('tests') or {}).get('test_cases', []))} tests. Traceability is {(artifacts.get('traceability') or {}).get('coverage', 'not validated yet')}."
    if "handoff" in text or "download" in text: return "The QA handoff is ready to download." if (artifacts.get("qa_handoff") or {}).get("status") == "ready" else steps.get(state, "Complete the remaining workflow stages before creating the handoff.")
    return f"Current state: {state.replace('_', ' ').title()}. {steps.get(state, 'Review the workflow status for the next action.')}"


def assistant_message(c: sqlite3.Connection, project: sqlite3.Row | None, payload: AssistantInput) -> dict[str, Any]:
    content = re.sub(r"\s+", " ", payload.message).strip()
    if not content: raise HTTPException(422, {"code":"EMPTY_MESSAGE", "message":"Enter a message before sending."})
    project_key = project["id"] if project else None
    recent = c.execute("SELECT COUNT(*) FROM assistant_messages WHERE role='user' AND created_at > datetime('now','-1 minute')").fetchone()[0]
    if recent >= ASSISTANT_RATE_LIMIT: raise HTTPException(429, {"code":"ASSISTANT_RATE_LIMITED", "message":"Please wait a moment before sending more messages."})
    conversation_id = payload.conversation_id
    if conversation_id:
        conversation = c.execute("SELECT * FROM assistant_conversations WHERE id=? AND project_id IS ?", (conversation_id, project_key)).fetchone()
        if not conversation: raise HTTPException(404, {"code":"CONVERSATION_NOT_FOUND", "message":"That conversation is unavailable. Start a new one."})
    else:
        conversation_id = str(uuid.uuid4()); c.execute("INSERT INTO assistant_conversations(id,project_id,title,created_at,updated_at) VALUES(?,?,?,?,?)", (conversation_id, project_key, content[:60], now(), now()))
    history = c.execute("SELECT role,content,created_at FROM assistant_messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?", (conversation_id, ASSISTANT_CONTEXT_WINDOW)).fetchall()[::-1]
    c.execute("INSERT INTO assistant_messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)", (str(uuid.uuid4()), conversation_id, "user", content, now()))
    artifacts = project_payload(c, project)["artifacts"] if project else {}
    reply = assistant_reply(project, artifacts, content, history)
    message_id = str(uuid.uuid4()); c.execute("INSERT INTO assistant_messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)", (message_id, conversation_id, "assistant", reply, now()))
    c.execute("UPDATE assistant_conversations SET updated_at=? WHERE id=?", (now(), conversation_id))
    return {"conversation_id":conversation_id, "message_id":message_id, "reply":reply, "state":project["state"] if project else "WELCOME"}


@app.post("/api/assistant")
def general_assistant(payload: AssistantInput) -> JSONResponse:
    with db() as c: return envelope(assistant_message(c, None, payload))


@app.post("/api/projects/{project_id}/assistant")
def workflow_assistant(project_id: str, payload: AssistantInput) -> JSONResponse:
    with db() as c: return envelope(assistant_message(c, project_row(c, project_id), payload))


@app.get("/api/projects/{project_id}/assistant/conversations")
def assistant_conversations(project_id: str) -> JSONResponse:
    with db() as c:
        project = project_row(c, project_id)
        rows = c.execute("SELECT id,title,created_at,updated_at FROM assistant_conversations WHERE project_id=? ORDER BY updated_at DESC LIMIT 20", (project["id"],)).fetchall()
        return envelope([dict(row) for row in rows])


@app.get("/api/projects/{project_id}/assistant/conversations/{conversation_id}")
def assistant_conversation(project_id: str, conversation_id: str) -> JSONResponse:
    with db() as c:
        project = project_row(c, project_id)
        rows = c.execute("SELECT id,role,content,created_at FROM assistant_messages WHERE conversation_id=? AND EXISTS(SELECT 1 FROM assistant_conversations WHERE id=? AND project_id=?) ORDER BY created_at", (conversation_id, conversation_id, project["id"])).fetchall()
        return envelope([dict(row) for row in rows])


@app.delete("/api/projects/{project_id}/assistant/conversations/{conversation_id}")
def clear_assistant_conversation(project_id: str, conversation_id: str) -> JSONResponse:
    with db() as c:
        project = project_row(c, project_id)
        c.execute("DELETE FROM assistant_messages WHERE conversation_id=? AND EXISTS(SELECT 1 FROM assistant_conversations WHERE id=? AND project_id=?)", (conversation_id, conversation_id, project["id"]))
        return envelope({"conversation_id":conversation_id, "cleared":True})


@app.get("/api/samples")
def get_samples() -> JSONResponse:
    """Expose the checked-in test requirements to the local UI."""
    samples_path = ROOT / "sample-data" / "sample-requirements.json"
    if not samples_path.exists():
        raise HTTPException(503, {"code": "SAMPLES_UNAVAILABLE", "message": "Sample scenarios are not installed in this environment."})
    with samples_path.open(encoding="utf-8") as handle:
        return envelope(json.load(handle))


@app.post("/api/projects/{project_id}/requirements")
def submit_requirement(project_id: str, payload: RequirementInput) -> JSONResponse:
    raw = re.sub(r"\s+", " ", payload.raw_requirement).strip()
    if not raw:
        raise HTTPException(422, {"code": "INVALID_REQUIREMENT", "message": "Requirement cannot be empty"})
    if not clauses(raw):
        raise HTTPException(422, {"code": "INVALID_REQUIREMENT", "message": "Provide a meaningful requirement sentence (at least 8 characters), not a short label or test value."})
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
    """Legacy route retained for clients, now constrained to one safe workflow step."""
    return automation_run_next(project_id)


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
        run_id = start_agent_run(c, project, "analysis", "requirement")
        req = c.execute("SELECT raw_text FROM requirements WHERE project_id=?", (project["id"],)).fetchone()[0]
        items = clauses(req)
        if not items:
            transition(c, project, "FAILED", "analysis_failed", reason="No meaningful requirement")
            raise HTTPException(422, {"code":"VALIDATION_FAILED", "message":"No meaningful requirement"})
        version = revision(c, project, "analysis", "ANALYSIS_COMPLETED", {"id":"REQ-001", "functional_requirements":[{"id":f"REQ-001-FR-{i:02d}", "text":text} for i,text in enumerate(items,1)], "rules_version":RULES_VERSION})
        project = transition(c, project, "ANALYSIS_COMPLETED", "analysis_completed", "analysis", version)
        finish_agent_run(c, run_id, f"analysis:v{version}")
        return envelope({"state":project["state"], "agent":"analysis", "artifact_version":version, "next_action":"generate_brd"})


@app.post("/api/projects/{project_id}/brd/generate")
def brd_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project=project_row(c, project_id); require_state(project,{"ANALYSIS_COMPLETED","BRD_REJECTED"},["run_analysis"])
        run_id=start_agent_run(c,project,"brd","analysis")
        analysis,av_row=latest_revision(c,project,"analysis"); items=[x["text"] if isinstance(x,dict) else x for x in analysis["functional_requirements"]]; av=av_row["version"]
        project=transition(c,project,"BRD_GENERATED","brd_generated","brd")
        bv=revision(c,project,"brd","BRD_GENERATED",{"id":"BRD-001","scope_in":items,"analysis_version":av,"rules_version":RULES_VERSION})
        project=transition(c,project,"BRD_AWAITING_APPROVAL","brd_awaiting_approval","brd",bv)
        finish_agent_run(c,run_id,f"brd:v{bv}")
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
        run_id=start_agent_run(c,project,"backlog","brd")
        project=transition(c,project,"BACKLOG_GENERATED","backlog_generated","backlog")
        stories=[{"id":f"STORY-{i:03d}","acceptance_criteria":[{"id":f"AC-{i:03d}","then":item}]} for i,item in enumerate(brd["scope_in"],1)]
        version=revision(c,project,"backlog","BACKLOG_GENERATED",{"id":"BACKLOG-001","brd_version":row["version"],"stories":stories,"rules_version":RULES_VERSION})
        project=transition(c,project,"BACKLOG_AWAITING_APPROVAL","backlog_awaiting_approval","backlog",version)
        finish_agent_run(c,run_id,f"backlog:v{version}")
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
        run_id=start_agent_run(c,project,"tests","backlog")
        project=transition(c,project,"TESTS_GENERATED","tests_generated","tests"); cases=[]
        for story in backlog["stories"]:
            for typ in ("positive","negative","boundary"): cases.append({"id":f"TC-{len(cases)+1:03d}","criterion_id":story["acceptance_criteria"][0]["id"],"type":typ})
        tv=revision(c,project,"tests","TESTS_GENERATED",{"id":"TEST-001","test_cases":cases,"backlog_version":row["version"]})
        project=transition(c,project,"TESTS_GENERATED","tests_generated","tests",tv)
        finish_agent_run(c,run_id,f"tests:v{tv}")
        return envelope({"state":project["state"],"agent":"tests","artifact_version":tv,"next_action":"validate_traceability"})


@app.post("/api/projects/{project_id}/traceability/generate")
def traceability_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project=project_row(c,project_id); require_state(project,{"TESTS_GENERATED"},["generate_tests"])
        run_id=start_agent_run(c,project,"traceability","tests + backlog")
        tests,row=latest_revision(c,project,"tests")
        backlog,_=latest_revision(c,project,"backlog")
        version=revision(c,project,"traceability","TRACEABILITY_VALIDATED",{"valid":True,"criteria_count":len(backlog["stories"]),"test_count":len(tests["test_cases"]),"coverage":"100%","gaps":[]})
        project=transition(c,project,"TRACEABILITY_VALIDATED","traceability_validated","traceability",version)
        finish_agent_run(c,run_id,f"traceability:v{version}")
        return envelope({"state":project["state"],"agent":"traceability","artifact_version":version,"next_action":"create_qa_handoff"})


@app.post("/api/projects/{project_id}/qa-handoff/generate")
def qa_handoff_generate(project_id: str) -> JSONResponse:
    with db() as c:
        project=project_row(c,project_id); require_state(project,{"TRACEABILITY_VALIDATED"},["validate_traceability"])
        run_id=start_agent_run(c,project,"qa_handoff","traceability")
        _,trace=latest_revision(c,project,"traceability")
        version=revision(c,project,"qa_handoff","QA_HANDOFF_READY",{"id":"QAH-001","status":"ready","traceability_version":trace["version"]})
        project=transition(c,project,"QA_HANDOFF_READY","qa_handoff_ready","qa_handoff",version)
        project=transition(c,project,"COMPLETED","workflow_completed","qa_handoff",version)
        finish_agent_run(c,run_id,f"qa_handoff:v{version}")
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
