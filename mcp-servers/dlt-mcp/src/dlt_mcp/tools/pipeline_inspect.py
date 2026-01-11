"""Tool for inspecting dlt pipeline execution details."""

import os
from typing import Optional, Dict, Any
from pathlib import Path
from dlt.pipeline import Pipeline
from dlt.pipeline.pipeline import LoadInfo

from ..utils import find_pipeline, validate_pipeline_name, validate_working_dir
from ..types import LoadInfo as LoadInfoType


async def inspect_pipeline(
    pipeline_name: Optional[str] = None,
    working_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Inspect dlt pipeline execution details.

    Args:
        pipeline_name: Name of the pipeline to inspect. If None, auto-discovers.
        working_dir: Directory to search for pipelines.

    Returns:
        Dictionary with load info, timing, file sizes, and rows loaded.
    """
    # Validate inputs
    validated_name = validate_pipeline_name(pipeline_name) if pipeline_name else None
    validated_dir = validate_working_dir(working_dir) if working_dir else None

    # Find the pipeline
    pipeline = find_pipeline(validated_name, validated_dir)
    if pipeline is None:
        return {
            "error": f"Pipeline not found: {pipeline_name or 'auto-discover'}",
            "available_pipelines": []
        }

    try:
        # Get pipeline info
        pipeline_info = {
            "name": pipeline.pipeline_name,
            "destination": pipeline.destination.destination_name if hasattr(pipeline, 'destination') and pipeline.destination else None,
            "dataset_name": pipeline.dataset_name if hasattr(pipeline, 'dataset_name') else None,
        }

        # Get load information
        loads: list[LoadInfoType] = []
        file_sizes: Dict[str, int] = {}
        rows_loaded: Dict[str, int] = {}

        # Try to get the latest load info
        try:
            # Access the pipeline's load history
            if hasattr(pipeline, 'list_completed_loads'):
                completed_loads = pipeline.list_completed_loads()
                for load_id in completed_loads[:10]:  # Get last 10 loads
                    try:
                        load_info = pipeline.get_load_package_info(load_id)
                        if load_info:
                            load_data = {
                                "load_id": load_id,
                                "status": "completed",
                                "started_at": str(load_info.started_at) if hasattr(load_info, 'started_at') else None,
                                "finished_at": str(load_info.finished_at) if hasattr(load_info, 'finished_at') else None,
                            }

                            # Calculate duration
                            if load_data["started_at"] and load_data["finished_at"]:
                                from datetime import datetime
                                try:
                                    start = datetime.fromisoformat(load_data["started_at"].replace('Z', '+00:00'))
                                    finish = datetime.fromisoformat(load_data["finished_at"].replace('Z', '+00:00'))
                                    duration = (finish - start).total_seconds()
                                    load_data["duration_seconds"] = duration
                                except Exception:
                                    pass

                            # Get table information
                            tables = []
                            if hasattr(load_info, 'schema_update'):
                                # Extract table info from schema updates
                                pass

                            loads.append(LoadInfoType(**load_data))
                    except Exception:
                        pass
        except Exception:
            # If we can't get load info, continue with basic info
            pass

        # Get file sizes from the pipeline directory
        try:
            pipeline_dir = Path(pipeline.pipelines_dir) / pipeline.pipeline_name if hasattr(pipeline, 'pipelines_dir') else None
            if pipeline_dir and pipeline_dir.exists():
                for file_path in pipeline_dir.rglob("*"):
                    if file_path.is_file():
                        file_size = file_path.stat().st_size
                        relative_path = str(file_path.relative_to(pipeline_dir))
                        file_sizes[relative_path] = file_size
        except Exception:
            pass

        # Try to get row counts from destination
        try:
            if hasattr(pipeline, 'destination') and pipeline.destination:
                from ..utils.db_connector import get_destination_connection, execute_query
                conn = get_destination_connection(pipeline)
                if conn:
                    try:
                        # Get table names from schema
                        if hasattr(pipeline, 'schema') and pipeline.schema:
                            for table_name in pipeline.schema.tables.keys():
                                try:
                                    query = f"SELECT COUNT(*) as count FROM {table_name}"
                                    result = execute_query(conn, query, limit=1)
                                    if result["rows"]:
                                        rows_loaded[table_name] = result["rows"][0].get("count", 0)
                                except Exception:
                                    pass
                    finally:
                        if hasattr(conn, 'close'):
                            conn.close()
        except Exception:
            pass

        return {
            "pipeline": pipeline_info,
            "loads": [load.model_dump() for load in loads],
            "file_sizes": file_sizes,
            "rows_loaded": rows_loaded,
            "latest_load": loads[0].model_dump() if loads else None
        }

    except Exception as e:
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "pipeline_name": pipeline.pipeline_name if pipeline else None
        }

