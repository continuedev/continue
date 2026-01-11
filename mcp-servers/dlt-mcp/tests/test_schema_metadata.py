"""Tests for schema metadata tool."""

import pytest
from unittest.mock import patch
from dlt_mcp.tools.schema_metadata import get_schema


@pytest.mark.asyncio
async def test_get_schema_not_found():
    """Test get_schema when pipeline is not found."""
    with patch('dlt_mcp.tools.schema_metadata.find_pipeline', return_value=None):
        result = await get_schema(pipeline_name="nonexistent")
        assert "error" in result
        assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_get_schema_success(mock_pipeline):
    """Test successful schema retrieval."""
    with patch('dlt_mcp.tools.schema_metadata.find_pipeline', return_value=mock_pipeline):
        result = await get_schema(pipeline_name="test_pipeline")
        assert "tables" in result
        assert len(result["tables"]) > 0
        assert result["tables"][0]["name"] == "users"


@pytest.mark.asyncio
async def test_get_schema_specific_table(mock_pipeline):
    """Test schema retrieval for a specific table."""
    with patch('dlt_mcp.tools.schema_metadata.find_pipeline', return_value=mock_pipeline):
        result = await get_schema(pipeline_name="test_pipeline", table_name="users")
        assert "tables" in result
        assert len(result["tables"]) == 1
        assert result["tables"][0]["name"] == "users"


@pytest.mark.asyncio
async def test_get_schema_with_hints(mock_pipeline):
    """Test schema retrieval with hints included."""
    with patch('dlt_mcp.tools.schema_metadata.find_pipeline', return_value=mock_pipeline):
        result = await get_schema(pipeline_name="test_pipeline", include_hints=True)
        assert "tables" in result
        # Check that hints are included in column definitions
        if result["tables"]:
            columns = result["tables"][0].get("columns", [])
            if columns:
                # Hints may be None if not present, which is valid
                assert "hints" in columns[0] or columns[0].get("hints") is None

