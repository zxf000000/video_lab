"""Static file and asset serving routes."""
from __future__ import annotations

from pathlib import Path

from ..db import ASSETS_DIR, BACKEND_DIR
from . import register, serve_file


STATIC_DIR = BACKEND_DIR / "static"


@register("GET", r"/assets/.*")
def serve_asset(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    return serve_file(start_response, ASSETS_DIR / path.removeprefix("/assets/"))


@register("GET", r"/static/.*")
def serve_static(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    return serve_file(start_response, STATIC_DIR / path.removeprefix("/static/"))
