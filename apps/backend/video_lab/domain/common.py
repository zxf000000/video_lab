from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(slots=True)
class ServiceResult:
    ok: bool
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class DomainError(ValueError):
    """Base exception for domain-level validation and workflow failures."""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_dict(row) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def rows_to_dicts(rows) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def normalize_json_text(value: Any, default: Any) -> str:
    if value in (None, ""):
        value = default
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def normalize_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
