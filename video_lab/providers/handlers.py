"""Model-specific handlers for Kling provider.

Each handler encapsulates submit/poll/extract logic for a specific model family.
Currently returns None for all models, falling back to the generic API path in KlingProvider.
"""


def get_handler(model_name: str, provider):
    """Return a handler instance for the given model, or None for fallback."""
    return None
