"""Tests for database connector utilities."""

import pytest
from dlt_mcp.utils.db_connector import validate_sql_query, get_destination_connection
from unittest.mock import Mock, patch


def test_validate_sql_query_select():
    """Test validation of valid SELECT queries."""
    is_valid, error = validate_sql_query("SELECT * FROM users")
    assert is_valid is True
    assert error is None

    is_valid, error = validate_sql_query("SELECT id, name FROM users WHERE id > 10")
    assert is_valid is True
    assert error is None


def test_validate_sql_query_dangerous_keywords():
    """Test validation rejects dangerous SQL keywords."""
    dangerous_queries = [
        "DELETE FROM users",
        "INSERT INTO users VALUES (1, 'test')",
        "UPDATE users SET name = 'test'",
        "DROP TABLE users",
        "CREATE TABLE test",
        "ALTER TABLE users ADD COLUMN test",
    ]

    for query in dangerous_queries:
        is_valid, error = validate_sql_query(query)
        assert is_valid is False
        assert error is not None
        assert "forbidden" in error.lower() or "SELECT" in error


def test_validate_sql_query_with_comments():
    """Test validation handles SQL comments correctly."""
    query = "-- This is a comment\nSELECT * FROM users"
    is_valid, error = validate_sql_query(query)
    assert is_valid is True

    query = "/* Multi-line comment */ SELECT * FROM users"
    is_valid, error = validate_sql_query(query)
    assert is_valid is True


def test_validate_sql_query_case_insensitive():
    """Test validation is case-insensitive."""
    is_valid, error = validate_sql_query("select * from users")
    assert is_valid is True

    is_valid, error = validate_sql_query("delete from users")
    assert is_valid is False


def test_get_destination_connection_duckdb(mock_pipeline):
    """Test getting DuckDB connection."""
    mock_pipeline.destination.destination_name = "duckdb"
    with patch('dlt_mcp.utils.db_connector.duckdb') as mock_duckdb:
        mock_conn = Mock()
        mock_duckdb.connect.return_value = mock_conn
        result = get_destination_connection(mock_pipeline)
        assert result is not None


def test_get_destination_connection_postgres(mock_pipeline):
    """Test getting PostgreSQL connection."""
    mock_pipeline.destination.destination_name = "postgres"
    mock_pipeline.destination.credentials = Mock()
    mock_pipeline.destination.credentials.host = "localhost"
    mock_pipeline.destination.credentials.port = 5432
    mock_pipeline.destination.credentials.database = "test"
    mock_pipeline.destination.credentials.username = "user"
    mock_pipeline.destination.credentials.password = "pass"

    with patch('dlt_mcp.utils.db_connector.psycopg2') as mock_psycopg2:
        mock_conn = Mock()
        mock_psycopg2.connect.return_value = mock_conn
        result = get_destination_connection(mock_pipeline)
        assert result is not None

