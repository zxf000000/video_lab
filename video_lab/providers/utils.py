from __future__ import annotations

import base64
from pathlib import Path

import requests


def download_asset(url: str, filename: str, assets_dir: Path) -> str:
    """Download a file from URL and save to assets_dir. Returns filename."""
    path = assets_dir / filename
    # Handle base64 data URIs or raw base64 strings
    if url.startswith("data:"):
        b64_data = url.split(",", 1)[1]
        path.write_bytes(base64.b64decode(b64_data))
    elif not url.startswith("http"):
        # Likely a raw base64 string
        path.write_bytes(base64.b64decode(url))
    else:
        resp = requests.get(url, timeout=120, proxies={"http": None, "https": None})
        resp.raise_for_status()
        path.write_bytes(resp.content)
    return filename
