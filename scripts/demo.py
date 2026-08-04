"""Produce repeatable, machine-readable happy-path and guardrail evidence."""
import json
import os
import sys
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

with tempfile.TemporaryDirectory() as directory:
    os.environ["SDLC_DATABASE_PATH"] = str(Path(directory) / "demo.db")
    import backend.src.main as main
    main.init_db()
    client = TestClient(main.app)
    project = client.post("/api/projects", json={"name": "Automated demo"}).json()["data"]["public_id"]
    client.post(f"/api/projects/{project}/requirements", json={"raw_requirement": "Users can save a shopping list. Users can rename a shopping list."})
    states = []
    states.append(client.post(f"/api/projects/{project}/analysis/generate").json()["data"]["state"])
    states.append(client.post(f"/api/projects/{project}/brd/generate").json()["data"]["state"])
    client.post(f"/api/projects/{project}/brd/approve", json={"reviewer": "Demo reviewer"})
    states.append(client.post(f"/api/projects/{project}/backlog/generate").json()["data"]["state"])
    client.post(f"/api/projects/{project}/backlog/approve", json={"reviewer": "Demo reviewer"})
    states.append(client.post(f"/api/projects/{project}/tests/generate").json()["data"]["state"])
    states.append(client.post(f"/api/projects/{project}/traceability/generate").json()["data"]["state"])
    happy = client.post(f"/api/projects/{project}/qa-handoff/generate").json()
    duplicate = client.post(f"/api/projects/{project}/requirements", json={"raw_requirement": "Users can save a shopping list. Users can rename a shopping list."}).json()
    payload = client.get(f"/api/projects/{project}").json()["data"]
    print(json.dumps({"happy_path": happy["data"], "states": states, "agent_runs": payload["agent_runs"], "duplicate_guardrail": duplicate["error"]}, indent=2))
