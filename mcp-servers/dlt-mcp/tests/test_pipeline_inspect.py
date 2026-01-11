"""Tests for pipeline inspection tool."""

import pytest
from unittest.mock import patch, Mock
from dlt_mcp.tools.pipeline_inspect import inspect_pipeline


@pytest.mark.asyncio
async def test_inspect_pipeline_not_found():
    """Test inspect_pipeline when pipeline is not found."""
    with patch('dlt_mcp.tools.pipeline_inspect.find_pipeline', return_value=None):
        result = await inspect_pipeline(pipeline_name="nonexistent")
        assert "error" in result
        assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_inspect_pipeline_success(mock_pipeline):
    """Test successful pipeline inspection."""
    with patch('dlt_mcp.tools.pipeline_inspect.find_pipeline', return_value=mock_pipeline):
        with patch('pathlib.Path.exists', return_value=True):
            with patch('pathlib.Path.rglob', return_value=[]):
                result = await inspect_pipeline(pipeline_name="test_pipeline")
                assert "pipeline" in result
                assert result["pipeline"]["name"] == "test_pipeline"


@pytest.mark.asyncio
async def test_inspect_pipeline_with_loads(mock_pipeline_with_loads):
    """Test pipeline inspection with load information."""
    with patch('dlt_mcp.tools.pipeline_inspect.find_pipeline', return_value=mock_pipeline_with_loads):
        with patch('pathlib.Path.exists', return_value=True):
            with patch('pathlib.Path.rglob', return_value=[]):
                result = await inspect_pipeline(pipeline_name="test_pipeline")
                assert "pipeline" in result
                assert "loads" in result

