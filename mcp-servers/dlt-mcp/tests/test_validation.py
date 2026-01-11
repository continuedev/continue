"""Tests for validation utilities."""

import pytest
from dlt_mcp.utils.validation import validate_pipeline_name, validate_working_dir
from pathlib import Path
import tempfile
import os


def test_validate_pipeline_name_valid():
    """Test validation of valid pipeline names."""
    assert validate_pipeline_name("my_pipeline") == "my_pipeline"
    assert validate_pipeline_name("pipeline-123") == "pipeline-123"
    assert validate_pipeline_name("  valid_name  ") == "valid_name"


def test_validate_pipeline_name_invalid():
    """Test validation of invalid pipeline names."""
    assert validate_pipeline_name("") is None
    assert validate_pipeline_name("path/to/pipeline") is None
    assert validate_pipeline_name("path\\to\\pipeline") is None
    assert validate_pipeline_name(None) is None


def test_validate_working_dir_valid():
    """Test validation of valid working directories."""
    with tempfile.TemporaryDirectory() as temp_dir:
        result = validate_working_dir(temp_dir)
        assert result == str(Path(temp_dir).resolve())


def test_validate_working_dir_invalid():
    """Test validation of invalid working directories."""
    assert validate_working_dir("/nonexistent/path") is None
    assert validate_working_dir(None) is None
    # Create a file, not a directory
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        temp_file_path = temp_file.name
        temp_file.close()  # Close the file handle on Windows
        try:
            assert validate_working_dir(temp_file_path) is None
        finally:
            try:
                os.unlink(temp_file_path)
            except (OSError, PermissionError):
                # On Windows, file might still be locked, ignore
                pass

