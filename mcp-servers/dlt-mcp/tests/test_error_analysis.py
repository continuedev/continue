"""Tests for error analysis tool."""

import pytest
from unittest.mock import patch, Mock
from dlt_mcp.tools.error_analysis import analyze_errors


@pytest.mark.asyncio
async def test_analyze_errors_pipeline_not_found():
    """Test analyze_errors when pipeline is not found."""
    with patch('dlt_mcp.tools.error_analysis.find_pipeline', return_value=None):
        result = await analyze_errors(pipeline_name="nonexistent")
        assert "error" in result
        assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_analyze_errors_no_errors(mock_pipeline):
    """Test analyze_errors when no errors are found."""
    with patch('dlt_mcp.tools.error_analysis.find_pipeline', return_value=mock_pipeline):
        with patch('pathlib.Path.exists', return_value=False):
            result = await analyze_errors(pipeline_name="test_pipeline")
            assert "status" in result
            assert result["status"] == "no_errors_found"


@pytest.mark.asyncio
async def test_analyze_errors_with_errors(mock_pipeline):
    """Test analyze_errors when errors are found."""
    # Create a mock error file
    mock_error_file = Mock()
    mock_error_file.read_text.return_value = "Test error message"
    mock_error_file.name = "test_error.log"

    with patch('dlt_mcp.tools.error_analysis.find_pipeline', return_value=mock_pipeline):
        with patch('pathlib.Path.exists', return_value=True):
            with patch('pathlib.Path.rglob', return_value=[mock_error_file]):
                result = await analyze_errors(pipeline_name="test_pipeline")
                assert "errors" in result
                assert result["error_count"] > 0


@pytest.mark.asyncio
async def test_analyze_errors_suggest_fix():
    """Test error fix suggestion generation."""
    from dlt_mcp.tools.error_analysis import _suggest_fix

    # Test connection error
    suggestion = _suggest_fix("ConnectionError", "Connection failed")
    assert "connection" in suggestion.lower() or "credentials" in suggestion.lower()

    # Test type error
    suggestion = _suggest_fix("TypeError", "Cannot cast to int")
    assert "type" in suggestion.lower() or "data" in suggestion.lower()

