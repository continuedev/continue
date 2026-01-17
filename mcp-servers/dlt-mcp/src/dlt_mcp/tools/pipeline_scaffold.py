"""Tool for scaffolding new dlt pipelines."""

from typing import Dict, Any


async def scaffold_pipeline(
    source_type: str,
    destination: str,
    pipeline_name: str
) -> Dict[str, Any]:
    """
    Generate scaffold code for a new dlt pipeline.

    Args:
        source_type: Type of data source: "rest_api", "sql_database", "filesystem"
        destination: Destination database: "duckdb", "postgres", "bigquery", etc.
        pipeline_name: Name for the new pipeline.

    Returns:
        Dictionary with generated code snippets, file structure, and next steps.
    """
    # Validate inputs
    valid_sources = ["rest_api", "sql_database", "filesystem"]
    if source_type not in valid_sources:
        return {
            "error": f"Invalid source_type: {source_type}. Must be one of {valid_sources}",
            "code": None
        }

    valid_destinations = ["duckdb", "postgres", "bigquery", "snowflake"]
    if destination not in valid_destinations:
        return {
            "error": f"Invalid destination: {destination}. Must be one of {valid_destinations}",
            "code": None
        }

    # Generate code based on source type
    if source_type == "rest_api":
        code = _scaffold_rest_api_pipeline(pipeline_name, destination)
    elif source_type == "sql_database":
        code = _scaffold_sql_database_pipeline(pipeline_name, destination)
    elif source_type == "filesystem":
        code = _scaffold_filesystem_pipeline(pipeline_name, destination)
    else:
        code = None

    return {
        "pipeline_name": pipeline_name,
        "source_type": source_type,
        "destination": destination,
        "code": code,
        "file_structure": _get_file_structure(pipeline_name),
        "next_steps": _get_next_steps(source_type, destination, pipeline_name)
    }


def _scaffold_rest_api_pipeline(pipeline_name: str, destination: str) -> Dict[str, str]:
    """Generate code for a REST API pipeline."""
    destination_config = _get_destination_config(destination)

    code = f'''"""
{destination_config["description"]}
"""

import dlt
from dlt.sources.helpers import requests

@dlt.source
def {pipeline_name}_source(api_key: str = dlt.secrets.value):
    """
    Source function for {pipeline_name} API.
    
    Args:
        api_key: API key for authentication (stored in secrets.toml)
    """
    
    @dlt.resource
    def users():
        """Load users from API"""
        url = "https://api.example.com/users"
        headers = {{"Authorization": f"Bearer {{api_key}}"}}
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        yield response.json()
    
    return users()


if __name__ == "__main__":
    # Configure pipeline
    pipeline = dlt.pipeline(
        pipeline_name="{pipeline_name}",
        destination="{destination}",
        dataset_name="{pipeline_name}_data"
    )
    
    # Run pipeline
    load_info = pipeline.run({pipeline_name}_source())
    print(load_info)
'''
    return {
        "main_file": f"{pipeline_name}_pipeline.py",
        "content": code,
        "description": f"REST API pipeline scaffold for {pipeline_name}"
    }


def _scaffold_sql_database_pipeline(pipeline_name: str, destination: str) -> Dict[str, str]:
    """Generate code for a SQL database pipeline."""
    destination_config = _get_destination_config(destination)

    code = f'''"""
{destination_config["description"]}
"""

import dlt
from dlt.sources.sql_database import sql_database

@dlt.source
def {pipeline_name}_source():
    """
    Source function for {pipeline_name} SQL database.
    """
    
    # Configure source database connection
    # Update connection string in secrets.toml
    return sql_database(
        credentials=dlt.secrets["source_db"],
        schema="public",  # Update schema name as needed
        table_names=["users", "orders"]  # Update table names as needed
    )


if __name__ == "__main__":
    # Configure pipeline
    pipeline = dlt.pipeline(
        pipeline_name="{pipeline_name}",
        destination="{destination}",
        dataset_name="{pipeline_name}_data"
    )
    
    # Run pipeline
    load_info = pipeline.run({pipeline_name}_source())
    print(load_info)
'''
    return {
        "main_file": f"{pipeline_name}_pipeline.py",
        "content": code,
        "description": f"SQL database pipeline scaffold for {pipeline_name}"
    }


def _scaffold_filesystem_pipeline(pipeline_name: str, destination: str) -> Dict[str, str]:
    """Generate code for a filesystem pipeline."""
    destination_config = _get_destination_config(destination)

    code = f'''"""
{destination_config["description"]}
"""

import dlt
from dlt.sources.filesystem import filesystem

@dlt.source
def {pipeline_name}_source():
    """
    Source function for {pipeline_name} filesystem.
    """
    
    # Configure filesystem source
    # Update path in secrets.toml or pass directly
    return filesystem(
        bucket_url="path/to/data",  # Update path as needed
        file_glob="*.csv"  # Update file pattern as needed
    )


if __name__ == "__main__":
    # Configure pipeline
    pipeline = dlt.pipeline(
        pipeline_name="{pipeline_name}",
        destination="{destination}",
        dataset_name="{pipeline_name}_data"
    )
    
    # Run pipeline
    load_info = pipeline.run({pipeline_name}_source())
    print(load_info)
'''
    return {
        "main_file": f"{pipeline_name}_pipeline.py",
        "content": code,
        "description": f"Filesystem pipeline scaffold for {pipeline_name}"
    }


def _get_destination_config(destination: str) -> Dict[str, str]:
    """Get destination-specific configuration."""
    configs = {
        "duckdb": {
            "description": "Pipeline loads data to DuckDB (local file-based database)",
            "credentials": "# DuckDB doesn't require credentials, uses local file"
        },
        "postgres": {
            "description": "Pipeline loads data to PostgreSQL database",
            "credentials": '''# Add to .dlt/secrets.toml:
[destination.postgres.credentials]
host = "localhost"
port = 5432
database = "your_database"
username = "your_username"
password = "your_password"'''
        },
        "bigquery": {
            "description": "Pipeline loads data to Google BigQuery",
            "credentials": '''# Add to .dlt/secrets.toml:
[destination.bigquery.credentials]
project_id = "your-project-id"
private_key = "path/to/service-account-key.json"'''
        },
        "snowflake": {
            "description": "Pipeline loads data to Snowflake",
            "credentials": '''# Add to .dlt/secrets.toml:
[destination.snowflake.credentials]
database = "your_database"
password = "your_password"
username = "your_username"
warehouse = "your_warehouse"
host = "your_account.snowflakecomputing.com"'''
        }
    }
    return configs.get(destination, {"description": f"Pipeline loads data to {destination}", "credentials": ""})


def _get_file_structure(pipeline_name: str) -> Dict[str, Any]:
    """Get recommended file structure."""
    return {
        "files": [
            f"{pipeline_name}_pipeline.py",
            ".dlt/secrets.toml",
            ".dlt/config.toml",
            "requirements.txt"
        ],
        "directories": [
            ".dlt/",
            "data/"  # Optional: for local data files
        ]
    }


def _get_next_steps(source_type: str, destination: str, pipeline_name: str) -> list[str]:
    """Get next steps for setting up the pipeline."""
    steps = [
        f"1. Create the pipeline file: {pipeline_name}_pipeline.py",
        "2. Configure destination credentials in .dlt/secrets.toml",
        "3. Install dependencies: pip install dlt",
        f"4. Run the pipeline: python {pipeline_name}_pipeline.py"
    ]

    if source_type == "rest_api":
        steps.insert(1, "2. Add API credentials to .dlt/secrets.toml")
    elif source_type == "sql_database":
        steps.insert(1, "2. Configure source database connection in .dlt/secrets.toml")

    return steps

