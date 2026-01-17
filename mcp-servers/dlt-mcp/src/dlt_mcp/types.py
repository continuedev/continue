"""Type definitions for dlt MCP server."""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class PipelineInfo(BaseModel):
    """Information about a dlt pipeline."""

    name: str
    pipeline_dir: str
    destination: Optional[str] = None
    dataset_name: Optional[str] = None


class LoadInfo(BaseModel):
    """Pipeline load execution information."""

    load_id: str
    status: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    tables: List[Dict[str, Any]] = []
    file_sizes: Dict[str, int] = {}
    rows_loaded: Dict[str, int] = {}


class SchemaColumn(BaseModel):
    """Schema column definition."""

    name: str
    data_type: str
    nullable: bool = True
    primary_key: bool = False
    hints: Optional[Dict[str, Any]] = None


class SchemaTable(BaseModel):
    """Schema table definition."""

    name: str
    columns: List[SchemaColumn]
    resource_name: Optional[str] = None


class PipelineError(BaseModel):
    """Pipeline error information."""

    error_type: str
    message: str
    table_name: Optional[str] = None
    load_id: Optional[str] = None
    stack_trace: Optional[str] = None
    suggested_fix: Optional[str] = None


class SchemaEvolution(BaseModel):
    """Schema evolution information."""

    table_name: str
    added_columns: List[SchemaColumn] = []
    removed_columns: List[str] = []
    modified_columns: List[Dict[str, Any]] = []
    type_changes: List[Dict[str, Any]] = []

