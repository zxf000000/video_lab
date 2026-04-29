"""WSGI application — thin dispatcher backed by route modules."""
from __future__ import annotations

from .db import init_db
from .routes import (
    _request_ctx, register_all_routes, dispatch,
    respond_json, respond_empty, respond_not_found,
)


def create_app():
    init_db()
    register_all_routes()

    def app(environ, start_response):
        method = environ.get("REQUEST_METHOD", "GET")
        path = environ.get("PATH_INFO", "/")
        _request_ctx.origin = environ.get("HTTP_ORIGIN", "")

        # CORS preflight
        if method == "OPTIONS":
            return respond_empty(start_response)

        # SSE chat stream (special response pattern, keep inline)
        if path == "/api/chat/stream" and method == "POST":
            from .chat import handle_chat_stream
            from .routes import parse_json
            payload = parse_json(environ)
            return handle_chat_stream(payload, start_response)

        try:
            result = dispatch(environ, start_response)
            if result is not None:
                return result
        except ValueError as exc:
            return respond_json(start_response, {"error": str(exc)}, status="400 Bad Request")
        except Exception as exc:
            return respond_json(start_response, {"error": str(exc)}, status="500 Internal Server Error")

        return respond_not_found(start_response)

    return app
