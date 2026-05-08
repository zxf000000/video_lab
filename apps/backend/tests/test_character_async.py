"""Tests for async character Copilot endpoints."""
from __future__ import annotations

import json


def test_optimize_prompt_rejects_nonexistent_character(client):
    """POST /api/characters/99999/optimize-prompt should return 404."""
    resp = client.post("/api/characters/99999/optimize-prompt")
    assert resp.status_code == 404


def test_generate_anchor_rejects_nonexistent_character(client):
    """POST /api/characters/99999/generate-anchor should return 404."""
    resp = client.post("/api/characters/99999/generate-anchor")
    assert resp.status_code == 404


def test_regenerate_rejects_missing_input(client, character):
    """POST /api/characters/{id}/regenerate without input should return 400."""
    resp = client.post(
        f"/api/characters/{character['id']}/regenerate",
        data=json.dumps({}),
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_optimize_prompt_accepts_valid_character(client, character):
    """POST /api/characters/{id}/optimize-prompt should return 202 with task."""
    resp = client.post(f"/api/characters/{character['id']}/optimize-prompt")
    assert resp.status_code == 202
    data = json.loads(resp.data)
    assert "task" in data
    assert data["task"]["status"] in ("queued", "running")


def test_generate_anchor_accepts_valid_character(client, character):
    """POST /api/characters/{id}/generate-anchor should return 202 with task."""
    resp = client.post(f"/api/characters/{character['id']}/generate-anchor")
    assert resp.status_code == 202
    data = json.loads(resp.data)
    assert "task" in data
    assert data["task"]["status"] in ("queued", "running")


def test_regenerate_accepts_valid_input(client, character):
    """POST /api/characters/{id}/regenerate with input should return 202."""
    resp = client.post(
        f"/api/characters/{character['id']}/regenerate",
        data=json.dumps({"input": "改为女性角色"}),
        content_type="application/json",
    )
    assert resp.status_code == 202
    data = json.loads(resp.data)
    assert "task" in data
    assert data["task"]["status"] in ("queued", "running")
