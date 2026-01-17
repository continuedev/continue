"""Tool for retrieving pipeline schema metadata."""

from typing import Optional, Dict, Any, List
from dlt.pipeline import Pipeline

from ..utils import find_pipeline, validate_pipeline_name
from ..types import SchemaTable, SchemaColumn


async def get_schema(
    pipeline_name: Optional[str] = None,
    table_name: Optional[str] = None,
    include_hints: bool = False
) -> Dict[str, Any]:
    """
    Retrieve pipeline schema metadata.

    Args:
        pipeline_name: Name of the pipeline. If None, uses first available.
        table_name: Specific table name. If None, returns all tables.
        include_hints: Include dlt hints and annotations.

    Returns:
        Dictionary with tables, columns, data types, and constraints.
    """
    # Validate inputs
    validated_name = validate_pipeline_name(pipeline_name) if pipeline_name else None

    # Find the pipeline
    pipeline = find_pipeline(validated_name)
    if pipeline is None:
        return {
            "error": f"Pipeline not found: {pipeline_name or 'auto-discover'}",
            "tables": []
        }

    try:
        # Get schema from pipeline
        if not hasattr(pipeline, 'schema') or pipeline.schema is None:
            return {
                "error": "Pipeline schema not available",
                "pipeline_name": pipeline.pipeline_name,
                "tables": []
            }

        schema = pipeline.schema
        tables: List[SchemaTable] = []

        # Iterate through schema tables
        for table_name_key, table_schema in schema.tables.items():
            # Filter by table_name if specified
            if table_name and table_name_key != table_name:
                continue

            columns: List[SchemaColumn] = []

            # Extract column information
            for column_name, column_schema in table_schema.get("columns", {}).items():
                # Get data type
                data_type = column_schema.get("data_type", "unknown")
                if isinstance(data_type, dict):
                    data_type = data_type.get("name", "unknown")

                # Get nullable
                nullable = column_schema.get("nullable", True)

                # Get primary key
                primary_key = column_schema.get("primary_key", False)

                # Get hints if requested
                hints = None
                if include_hints:
                    hints = {
                        "merge_key": column_schema.get("merge_key", False),
                        "unique": column_schema.get("unique", False),
                        "foreign_key": column_schema.get("foreign_key"),
                        "partition": column_schema.get("partition", False),
                    }
                    # Remove None values
                    hints = {k: v for k, v in hints.items() if v is not None and v is not False}

                columns.append(SchemaColumn(
                    name=column_name,
                    data_type=str(data_type),
                    nullable=nullable,
                    primary_key=primary_key,
                    hints=hints if include_hints and hints else None
                ))

            # Get resource name if available
            resource_name = table_schema.get("resource", table_name_key)

            tables.append(SchemaTable(
                name=table_name_key,
                columns=columns,
                resource_name=resource_name
            ))

        return {
            "pipeline_name": pipeline.pipeline_name,
            "tables": [table.model_dump() for table in tables],
            "table_count": len(tables)
        }

    except Exception as e:
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "pipeline_name": pipeline.pipeline_name if pipeline else None
        }

