"""Pytest fixtures for dlt MCP server tests."""

import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, MagicMock


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests."""
    temp_path = tempfile.mkdtemp()
    yield Path(temp_path)
    shutil.rmtree(temp_path)


@pytest.fixture
def mock_pipeline():
    """Create a mock dlt pipeline."""
    pipeline = Mock()
    pipeline.pipeline_name = "test_pipeline"
    pipeline.dataset_name = "test_dataset"
    pipeline.destination = Mock()
    pipeline.destination.destination_name = "duckdb"
    pipeline.schema = Mock()
    pipeline.schema.tables = {
        "users": {
            "columns": {
                "id": {"data_type": "bigint", "nullable": False, "primary_key": True},
                "name": {"data_type": "text", "nullable": True},
                "email": {"data_type": "text", "nullable": True}
            },
            "resource": "users"
        }
    }
    pipeline.pipelines_dir = "/tmp/.dlt/pipelines"
    return pipeline


@pytest.fixture
def mock_pipeline_with_loads(mock_pipeline):
    """Create a mock pipeline with load information."""
    def list_completed_loads():
        return ["load_1", "load_2"]

    def get_load_package_info(load_id):
        load_info = Mock()
        load_info.started_at = "2024-01-01T00:00:00Z"
        load_info.finished_at = "2024-01-01T00:05:00Z"
        return load_info

    mock_pipeline.list_completed_loads = list_completed_loads
    mock_pipeline.get_load_package_info = get_load_package_info
    return mock_pipeline

