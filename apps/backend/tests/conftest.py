"""Shared test fixtures for all test modules."""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


class _WSGIResponse:
    """Simple wrapper for WSGI test responses."""

    def __init__(self, status: str, headers: list, body: bytes):
        self.status = status
        self.headers = dict(headers)
        self.body = body

    @property
    def status_code(self) -> int:
        return int(self.status.split()[0])

    @property
    def data(self) -> bytes:
        return self.body


class _WSGIClient:
    """Simple WSGI test client."""

    def __init__(self, app):
        self._app = app

    def _request(
        self,
        method: str,
        path: str,
        data: str | None = None,
        content_type: str = "application/json",
    ) -> _WSGIResponse:
        body = data.encode("utf-8") if data is not None else b""
        environ = {
            "REQUEST_METHOD": method,
            "PATH_INFO": path,
            "CONTENT_TYPE": content_type,
            "CONTENT_LENGTH": str(len(body)),
            "wsgi.input": io.BytesIO(body),
            "HTTP_ORIGIN": "http://localhost:3000",
        }
        captured_status: list[str] = []
        captured_headers: list[tuple[str, str]] = []

        def start_response(status: str, headers: list[tuple[str, str]]) -> None:
            captured_status.append(status)
            captured_headers.extend(headers)

        result = self._app(environ, start_response)
        response_body = b"".join(result)
        return _WSGIResponse(captured_status[0], captured_headers, response_body)

    def post(
        self,
        path: str,
        data: str | None = None,
        content_type: str = "application/json",
    ) -> _WSGIResponse:
        return self._request("POST", path, data=data, content_type=content_type)


@pytest.fixture()
def db_setup(tmp_path):
    """Create a temp DB and monkey-patch the DB path."""
    import video_lab.db as dbmod

    orig_path = dbmod.DB_PATH
    orig_assets = dbmod.ASSETS_DIR
    orig_data = dbmod.DATA_DIR

    test_data = tmp_path / "data"
    test_assets = test_data / "assets"
    test_data.mkdir()
    test_assets.mkdir()

    dbmod.DB_PATH = test_data / "test.sqlite3"
    dbmod.ASSETS_DIR = test_assets
    dbmod.DATA_DIR = test_data

    from video_lab.db import init_db
    init_db()

    yield

    dbmod.DB_PATH = orig_path
    dbmod.ASSETS_DIR = orig_assets
    dbmod.DATA_DIR = orig_data


@pytest.fixture()
def client(db_setup):
    """WSGI test client backed by a temporary database."""
    from video_lab.web import create_app
    app = create_app()
    return _WSGIClient(app)


@pytest.fixture()
def character(db_setup):
    """Create a test project and character, return basic info dict."""
    from video_lab.domain.projects.service import ProjectsService
    from video_lab.domain.assets import AssetsService

    ps = ProjectsService()
    project_id = ps.create_project({
        "name": "测试项目",
        "genre": "都市短剧",
    })

    as_ = AssetsService()
    char_id = as_.upsert_character(project_id, {
        "name": "测试角色",
        "role_type": "主角",
        "identity_summary": "测试用角色",
        "appearance_summary": "年轻女性",
    })

    char = as_.repository.get_character(char_id)
    return {
        "id": char["id"],
        "project_id": char["project_id"],
    }
