"""Tool for querying destination databases with read-only SQL."""

from typing import Optional, Dict, Any
from dlt.pipeline import Pipeline

from ..utils import find_pipeline, validate_pipeline_name
from ..utils.db_connector import get_destination_connection, execute_query, validate_sql_query


async def query_destination(
    pipeline_name: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 100
) -> Dict[str, Any]:
    """
    Query data from the pipeline's destination database.

    Args:
        pipeline_name: Name of the pipeline. If None, uses first available.
        query: SQL SELECT query to execute.
        limit: Maximum number of rows to return.

    Returns:
        Dictionary with query results, column names, and row count.
    """
    if not query:
        return {
            "error": "Query parameter is required",
            "columns": [],
            "rows": [],
            "row_count": 0
        }

    # Validate query is read-only
    is_valid, error = validate_sql_query(query)
    if not is_valid:
        return {
            "error": error,
            "columns": [],
            "rows": [],
            "row_count": 0
        }

    # Validate inputs
    validated_name = validate_pipeline_name(pipeline_name) if pipeline_name else None

    # Find the pipeline
    pipeline = find_pipeline(validated_name)
    if pipeline is None:
        return {
            "error": f"Pipeline not found: {pipeline_name or 'auto-discover'}",
            "columns": [],
            "rows": [],
            "row_count": 0
        }

    try:
        # Get database connection
        conn = get_destination_connection(pipeline, limit=limit)
        if conn is None:
            return {
                "error": "Could not connect to destination database",
                "pipeline_name": pipeline.pipeline_name,
                "destination": pipeline.destination.destination_name if hasattr(pipeline, 'destination') and pipeline.destination else None,
                "columns": [],
                "rows": [],
                "row_count": 0
            }

        try:
            # Execute query
            result = execute_query(conn, query, limit=limit)

            return {
                "pipeline_name": pipeline.pipeline_name,
                "query": query,
                "columns": result["columns"],
                "rows": result["rows"],
                "row_count": result["row_count"],
                "limit_applied": limit
            }
        finally:
            # Close connection
            if hasattr(conn, 'close'):
                conn.close()

    except ValueError as e:
        # Query validation error
        return {
            "error": str(e),
            "error_type": "ValidationError",
            "query": query,
            "columns": [],
            "rows": [],
            "row_count": 0
        }
    except Exception as e:
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "pipeline_name": pipeline.pipeline_name if pipeline else None,
            "query": query,
            "columns": [],
            "rows": [],
            "row_count": 0
        }

