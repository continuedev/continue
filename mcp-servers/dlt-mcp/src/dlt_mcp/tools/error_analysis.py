"""Tool for analyzing pipeline load errors."""

from typing import Optional, Dict, Any, List
from pathlib import Path
from dlt.pipeline import Pipeline

from ..utils import find_pipeline, validate_pipeline_name
from ..types import PipelineError


async def analyze_errors(
    pipeline_name: Optional[str] = None,
    last_n_runs: int = 1
) -> Dict[str, Any]:
    """
    Analyze pipeline load errors and explain root causes.

    Args:
        pipeline_name: Name of the pipeline. If None, uses first available.
        last_n_runs: Number of recent runs to analyze.

    Returns:
        Dictionary with error details, affected tables, and suggested fixes.
    """
    # Validate inputs
    validated_name = validate_pipeline_name(pipeline_name) if pipeline_name else None

    # Find the pipeline
    pipeline = find_pipeline(validated_name)
    if pipeline is None:
        return {
            "error": f"Pipeline not found: {pipeline_name or 'auto-discover'}",
            "errors": [],
            "error_count": 0
        }

    try:
        errors: List[PipelineError] = []

        # Try to get error information from pipeline state
        try:
            # Check for error logs in the pipeline directory
            pipeline_dir = Path(pipeline.pipelines_dir) / pipeline.pipeline_name if hasattr(pipeline, 'pipelines_dir') else None
            if pipeline_dir and pipeline_dir.exists():
                # Look for error logs or failed load packages
                error_logs = list(pipeline_dir.rglob("*.error"))
                error_logs.extend(list(pipeline_dir.rglob("*error*.log")))

                for error_file in error_logs[:last_n_runs * 5]:  # Limit search
                    try:
                        error_content = error_file.read_text()
                        # Parse error content
                        error_type = "LoadError"
                        message = error_content[:500]  # First 500 chars
                        stack_trace = error_content if len(error_content) > 500 else None

                        # Try to extract table name from path
                        table_name = None
                        if "table" in error_file.name.lower():
                            parts = error_file.stem.split("_")
                            for part in parts:
                                if part not in ["error", "log", "load"]:
                                    table_name = part
                                    break

                        errors.append(PipelineError(
                            error_type=error_type,
                            message=message,
                            table_name=table_name,
                            stack_trace=stack_trace,
                            suggested_fix=_suggest_fix(error_type, message)
                        ))
                    except Exception:
                        pass
        except Exception:
            pass

        # Check for failed loads
        try:
            if hasattr(pipeline, 'list_failed_loads'):
                failed_loads = pipeline.list_failed_loads()
                for load_id in failed_loads[:last_n_runs]:
                    try:
                        load_info = pipeline.get_load_package_info(load_id)
                        if load_info and hasattr(load_info, 'exception'):
                            errors.append(PipelineError(
                                error_type=type(load_info.exception).__name__,
                                message=str(load_info.exception),
                                load_id=load_id,
                                suggested_fix=_suggest_fix(type(load_info.exception).__name__, str(load_info.exception))
                            ))
                    except Exception:
                        pass
        except Exception:
            pass

        # If no errors found, check for warnings
        if not errors:
            return {
                "pipeline_name": pipeline.pipeline_name,
                "errors": [],
                "error_count": 0,
                "status": "no_errors_found",
                "message": f"No errors found in the last {last_n_runs} run(s)"
            }

        return {
            "pipeline_name": pipeline.pipeline_name,
            "errors": [error.model_dump() for error in errors],
            "error_count": len(errors),
            "last_n_runs_checked": last_n_runs
        }

    except Exception as e:
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "pipeline_name": pipeline.pipeline_name if pipeline else None,
            "errors": [],
            "error_count": 0
        }


def _suggest_fix(error_type: str, message: str) -> Optional[str]:
    """Generate suggested fixes based on error type and message."""
    message_lower = message.lower()

    # Data type errors
    if "type" in message_lower or "cast" in message_lower:
        return "Check data types in source data. Consider adding data type hints in your pipeline schema."

    # Connection errors
    if "connection" in message_lower or "connect" in message_lower:
        return "Verify destination database credentials and network connectivity."

    # Permission errors
    if "permission" in message_lower or "access" in message_lower:
        return "Check database user permissions. Ensure the user has SELECT and INSERT privileges."

    # Schema errors
    if "schema" in message_lower or "column" in message_lower:
        return "Review schema changes. The source data structure may have changed."

    # Memory errors
    if "memory" in message_lower or "out of memory" in message_lower:
        return "Consider processing data in smaller batches or increasing available memory."

    # Generic suggestion
    return "Review the error message and check the pipeline configuration. Ensure source data matches expected schema."

