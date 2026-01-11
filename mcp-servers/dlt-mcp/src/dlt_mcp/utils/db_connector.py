"""Database connector utilities for safe read-only queries."""

import re
from typing import Optional, Dict, Any, List, Tuple
from dlt.pipeline import Pipeline
import duckdb
import psycopg2
from psycopg2.extras import RealDictCursor


def validate_sql_query(query: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that a SQL query is read-only (SELECT only).

    Args:
        query: SQL query string to validate.

    Returns:
        Tuple of (is_valid, error_message). is_valid is True if query is safe.
    """
    # Remove comments and normalize whitespace
    query_clean = re.sub(r'--.*?$', '', query, flags=re.MULTILINE)
    query_clean = re.sub(r'/\*.*?\*/', '', query_clean, flags=re.DOTALL)
    query_clean = ' '.join(query_clean.split())

    # Convert to uppercase for checking
    query_upper = query_clean.upper().strip()

    # Check for dangerous keywords
    dangerous_keywords = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
        'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL'
    ]

    for keyword in dangerous_keywords:
        # Use word boundaries to avoid false positives
        pattern = r'\b' + keyword + r'\b'
        if re.search(pattern, query_upper):
            return False, f"Query contains forbidden keyword: {keyword}. Only SELECT queries are allowed."

    # Must start with SELECT
    if not query_upper.startswith('SELECT'):
        return False, "Query must be a SELECT statement."

    return True, None


def get_destination_connection(pipeline: Pipeline, limit: int = 100) -> Optional[Any]:
    """
    Get a connection to the pipeline's destination database.

    Args:
        pipeline: dlt Pipeline object.
        limit: Maximum number of rows to return (for safety).

    Returns:
        Database connection object or None if connection fails.
    """
    if not hasattr(pipeline, 'destination') or pipeline.destination is None:
        return None

    destination_name = pipeline.destination.destination_name

    try:
        if destination_name == "duckdb":
            # For DuckDB, get the database path from the pipeline
            db_path = pipeline.pipeline_name
            if hasattr(pipeline.destination, 'credentials'):
                if hasattr(pipeline.destination.credentials, 'database'):
                    db_path = pipeline.destination.credentials.database
                elif isinstance(pipeline.destination.credentials, str):
                    db_path = pipeline.destination.credentials

            # DuckDB can work with in-memory or file-based databases
            conn = duckdb.connect(db_path, read_only=True)
            return conn

        elif destination_name == "postgres":
            # For PostgreSQL, get connection details
            if hasattr(pipeline.destination, 'credentials'):
                creds = pipeline.destination.credentials
                conn = psycopg2.connect(
                    host=getattr(creds, 'host', 'localhost'),
                    port=getattr(creds, 'port', 5432),
                    database=getattr(creds, 'database', 'postgres'),
                    user=getattr(creds, 'username', 'postgres'),
                    password=getattr(creds, 'password', ''),
                    cursor_factory=RealDictCursor
                )
                return conn

        # Add support for other destinations as needed
        # BigQuery, Snowflake, etc.

    except Exception as e:
        # Log error but don't raise - return None to indicate failure
        print(f"Failed to connect to destination: {e}")
        return None

    return None


def execute_query(connection: Any, query: str, limit: int = 100) -> Dict[str, Any]:
    """
    Execute a read-only query on the database connection.

    Args:
        connection: Database connection object.
        query: SQL SELECT query.
        limit: Maximum number of rows to return.

    Returns:
        Dictionary with query results, column names, and row count.
    """
    # Validate query first
    is_valid, error = validate_sql_query(query)
    if not is_valid:
        raise ValueError(error)

    # Add LIMIT if not present and limit is specified
    query_upper = query.upper()
    if limit > 0 and 'LIMIT' not in query_upper:
        query = f"{query.rstrip(';')} LIMIT {limit}"

    try:
        if isinstance(connection, duckdb.DuckDBPyConnection):
            # DuckDB
            cursor = connection.execute(query)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            # Convert to list of dicts
            results = [dict(zip(columns, row)) for row in rows]
            return {
                "columns": columns,
                "rows": results,
                "row_count": len(results)
            }

        elif hasattr(connection, 'cursor'):
            # PostgreSQL or similar
            cursor = connection.cursor()
            cursor.execute(query)
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            # If using RealDictCursor, rows are already dicts
            if rows and isinstance(rows[0], dict):
                results = rows
            else:
                results = [dict(zip(columns, row)) for row in rows]
            cursor.close()
            return {
                "columns": columns,
                "rows": results,
                "row_count": len(results)
            }

    except Exception as e:
        raise RuntimeError(f"Query execution failed: {str(e)}")

    raise ValueError("Unsupported database connection type")

