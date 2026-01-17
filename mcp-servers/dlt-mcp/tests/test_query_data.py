"""Tests for query destination tool."""

import pytest
from unittest.mock import patch, Mock
from dlt_mcp.tools.query_data import query_destination


@pytest.mark.asyncio
async def test_query_destination_no_query():
    """Test query_destination without query parameter."""
    result = await query_destination()
    assert "error" in result
    assert "required" in result["error"].lower()


@pytest.mark.asyncio
async def test_query_destination_invalid_query():
    """Test query_destination with invalid (non-SELECT) query."""
    result = await query_destination(query="DELETE FROM users")
    assert "error" in result
    assert "forbidden" in result["error"].lower() or "SELECT" in result["error"]


@pytest.mark.asyncio
async def test_query_destination_pipeline_not_found():
    """Test query_destination when pipeline is not found."""
    with patch('dlt_mcp.tools.query_data.find_pipeline', return_value=None):
        result = await query_destination(query="SELECT * FROM users")
        assert "error" in result
        assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_query_destination_success(mock_pipeline):
    """Test successful query execution."""
    mock_conn = Mock()
    mock_result = {
        "columns": ["id", "name"],
        "rows": [{"id": 1, "name": "Test"}],
        "row_count": 1
    }

    with patch('dlt_mcp.tools.query_data.find_pipeline', return_value=mock_pipeline):
        with patch('dlt_mcp.tools.query_data.get_destination_connection', return_value=mock_conn):
            with patch('dlt_mcp.tools.query_data.execute_query', return_value=mock_result):
                result = await query_destination(query="SELECT * FROM users", limit=10)
                assert "columns" in result
                assert "rows" in result
                assert result["row_count"] == 1


@pytest.mark.asyncio
async def test_query_destination_connection_failure(mock_pipeline):
    """Test query_destination when connection fails."""
    with patch('dlt_mcp.tools.query_data.find_pipeline', return_value=mock_pipeline):
        with patch('dlt_mcp.tools.query_data.get_destination_connection', return_value=None):
            result = await query_destination(query="SELECT * FROM users")
            assert "error" in result
            assert "connect" in result["error"].lower()

