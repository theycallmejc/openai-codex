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
    happy = client.post(f"/api/projects/{project}/requirements", json={"raw_requirement": "Users can save a shopping list. Users can rename a shopping list."}).json()
    duplicate = client.post(f"/api/projects/{project}/requirements", json={"raw_requirement": "Users can save a shopping list. Users can rename a shopping list."}).json()
    print(json.dumps({"happy_path": happy["data"], "duplicate_guardrail": duplicate["error"]}, indent=2))
