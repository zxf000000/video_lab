from __future__ import annotations

from ..domain.review_export import ReviewExportService
from . import (
    parse_json,
    register,
    respond_json,
    serialize_episode_export,
    serialize_review_issue,
)

review_export_service = ReviewExportService()


@register("GET", r"/api/episodes/(?P<episode_id>\d+)/review-issues")
def list_review_issues(environ, start_response, episode_id: str):
    issues = review_export_service.list_review_issues(int(episode_id))
    return respond_json(start_response, {"review_issues": [serialize_review_issue(i) for i in issues]})


@register("POST", r"/api/review-issues")
def create_review_issue(environ, start_response):
    payload = parse_json(environ)
    issue_id = review_export_service.create_review_issue(payload)
    issue = review_export_service.repository.get_review_issue(issue_id)
    return respond_json(start_response, {"review_issue": serialize_review_issue(issue)}, status="201 Created")


@register("POST", r"/api/review-issues/(?P<issue_id>\d+)/resolve")
def resolve_review_issue(environ, start_response, issue_id: str):
    payload = parse_json(environ)
    try:
        review_export_service.resolve_review_issue(int(issue_id), payload)
        issue = review_export_service.repository.get_review_issue(int(issue_id))
    except ValueError:
        return respond_json(start_response, {"error": "Review issue not found"}, status="404 Not Found")
    return respond_json(start_response, {"review_issue": serialize_review_issue(issue)})


@register("GET", r"/api/episodes/(?P<episode_id>\d+)/exports")
def list_episode_exports(environ, start_response, episode_id: str):
    exports = review_export_service.list_episode_exports(int(episode_id))
    return respond_json(start_response, {"exports": [serialize_episode_export(e) for e in exports]})


@register("POST", r"/api/episodes/(?P<episode_id>\d+)/exports")
def create_episode_export(environ, start_response, episode_id: str):
    payload = parse_json(environ)
    export_id = review_export_service.create_episode_export(int(episode_id), payload)
    export = review_export_service.repository.get_episode_export(export_id)
    return respond_json(start_response, {"export": serialize_episode_export(export)}, status="201 Created")


@register("POST", r"/api/exports/(?P<export_id>\d+)/render")
def render_episode_export(environ, start_response, export_id: str):
    payload = parse_json(environ)
    try:
        review_export_service.render_episode_export(int(export_id), payload)
        export = review_export_service.repository.get_episode_export(int(export_id))
    except ValueError:
        return respond_json(start_response, {"error": "Episode export not found"}, status="404 Not Found")
    return respond_json(start_response, {"export": serialize_episode_export(export)})
