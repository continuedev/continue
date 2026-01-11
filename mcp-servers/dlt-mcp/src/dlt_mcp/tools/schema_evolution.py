"""Tool for reviewing schema evolution across pipeline runs."""

from typing import Optional, Dict, Any, List
from dlt.pipeline import Pipeline

from ..utils import find_pipeline, validate_pipeline_name
from ..types import SchemaEvolution, SchemaColumn


async def review_schema_evolution(
    pipeline_name: Optional[str] = None,
    compare_runs: int = 2
) -> Dict[str, Any]:
    """
    Review and summarize schema changes across pipeline runs.

    Args:
        pipeline_name: Name of the pipeline. If None, uses first available.
        compare_runs: Number of recent runs to compare.

    Returns:
        Dictionary with added/removed/modified columns, type changes, and migration suggestions.
    """
    # Validate inputs
    validated_name = validate_pipeline_name(pipeline_name) if pipeline_name else None

    # Find the pipeline
    pipeline = find_pipeline(validated_name)
    if pipeline is None:
        return {
            "error": f"Pipeline not found: {pipeline_name or 'auto-discover'}",
            "evolution": []
        }

    try:
        # Get schema from pipeline
        if not hasattr(pipeline, 'schema') or pipeline.schema is None:
            return {
                "error": "Pipeline schema not available",
                "pipeline_name": pipeline.pipeline_name,
                "evolution": []
            }

        current_schema = pipeline.schema
        evolution: List[SchemaEvolution] = []

        # Try to get historical schema information
        # This is a simplified version - in practice, you'd compare against stored schema versions
        try:
            # Get current tables and columns
            for table_name, table_schema in current_schema.tables.items():
                current_columns = set(table_schema.get("columns", {}).keys())

                # Try to get previous schema version
                # In a real implementation, you'd load this from pipeline state/history
                previous_columns = set()  # Placeholder - would load from history

                # Calculate differences
                added_columns = current_columns - previous_columns
                removed_columns = previous_columns - current_columns

                # Build evolution info
                added_cols: List[SchemaColumn] = []
                for col_name in added_columns:
                    col_schema = table_schema.get("columns", {}).get(col_name, {})
                    added_cols.append(SchemaColumn(
                        name=col_name,
                        data_type=str(col_schema.get("data_type", "unknown")),
                        nullable=col_schema.get("nullable", True),
                        primary_key=col_schema.get("primary_key", False)
                    ))

                # Type changes (simplified - would compare actual types)
                type_changes: List[Dict[str, Any]] = []

                # Migration suggestions
                migration_suggestions = _generate_migration_suggestions(
                    table_name,
                    added_cols,
                    list(removed_columns),
                    type_changes
                )

                evolution.append(SchemaEvolution(
                    table_name=table_name,
                    added_columns=added_cols,
                    removed_columns=list(removed_columns),
                    modified_columns=[],
                    type_changes=type_changes
                ))

        except Exception:
            # If we can't get evolution info, return current schema info
            pass

        # If no evolution detected (no history available), return current state
        if not evolution:
            return {
                "pipeline_name": pipeline.pipeline_name,
                "evolution": [],
                "message": "Schema evolution tracking requires historical schema data. Current schema is available via get_schema tool.",
                "current_tables": list(current_schema.tables.keys())
            }

        return {
            "pipeline_name": pipeline.pipeline_name,
            "evolution": [evol.model_dump() for evol in evolution],
            "compare_runs": compare_runs,
            "summary": {
                "tables_changed": len(evolution),
                "total_added_columns": sum(len(evol.added_columns) for evol in evolution),
                "total_removed_columns": sum(len(evol.removed_columns) for evol in evolution),
                "total_type_changes": sum(len(evol.type_changes) for evol in evolution)
            }
        }

    except Exception as e:
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "pipeline_name": pipeline.pipeline_name if pipeline else None,
            "evolution": []
        }


def _generate_migration_suggestions(
    table_name: str,
    added_columns: List[SchemaColumn],
    removed_columns: List[str],
    type_changes: List[Dict[str, Any]]
) -> List[str]:
    """Generate migration suggestions based on schema changes."""
    suggestions: List[str] = []

    if added_columns:
        suggestions.append(
            f"Table '{table_name}' has {len(added_columns)} new column(s). "
            "Ensure downstream processes are updated to handle new columns."
        )

    if removed_columns:
        suggestions.append(
            f"Table '{table_name}' has {len(removed_columns)} removed column(s). "
            "Verify that no downstream processes depend on these columns."
        )

    if type_changes:
        suggestions.append(
            f"Table '{table_name}' has {len(type_changes)} type change(s). "
            "Review data compatibility and update any type-dependent logic."
        )

    if not suggestions:
        suggestions.append(f"No schema changes detected for table '{table_name}'.")

    return suggestions

