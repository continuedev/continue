"""Validation utilities for input parameters."""

import os
from pathlib import Path
from typing import Optional


def validate_pipeline_name(pipeline_name: Optional[str]) -> Optional[str]:
    """
    Validate pipeline name format.

    Args:
        pipeline_name: Pipeline name to validate.

    Returns:
        Validated pipeline name or None if invalid.
    """
    if pipeline_name is None:
        return None

    # Basic validation: no path separators, no empty string
    if not pipeline_name or '/' in pipeline_name or '\\' in pipeline_name:
        return None

    # Remove leading/trailing whitespace
    pipeline_name = pipeline_name.strip()
    if not pipeline_name:
        return None

    return pipeline_name


def validate_working_dir(working_dir: Optional[str]) -> Optional[str]:
    """
    Validate working directory path.

    Args:
        working_dir: Directory path to validate.

    Returns:
        Validated absolute path or None if invalid.
    """
    if working_dir is None:
        return None

    try:
        path = Path(working_dir).resolve()
        if path.exists() and path.is_dir():
            return str(path)
    except Exception:
        pass

    return None

