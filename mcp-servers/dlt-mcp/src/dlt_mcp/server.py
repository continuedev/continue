"""MCP server entry point for dlt pipeline inspection."""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .tools import (
    inspect_pipeline,
    get_schema,
    query_destination,
    analyze_errors,
    scaffold_pipeline,
    review_schema_evolution,
)


# Create the MCP server
server = Server("dlt-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all available tools."""
    return [
        Tool(
            name="inspect_pipeline",
            description="Inspect dlt pipeline execution details including load info, timing, file sizes, and rows loaded",
            inputSchema={
                "type": "object",
                "properties": {
                    "pipeline_name": {
                        "type": "string",
                        "description": "Name of the pipeline to inspect. If omitted, auto-discovers pipelines in the current directory."
                    },
                    "working_dir": {
                        "type": "string",
                        "description": "Directory to search for pipelines. Defaults to current working directory."
                    }
                }
            }
        ),
        Tool(
            name="get_schema",
            description="Retrieve pipeline schema metadata including tables, columns, data types, and constraints",
            inputSchema={
                "type": "object",
                "properties": {
                    "pipeline_name": {
                        "type": "string",
                        "description": "Name of the pipeline. If omitted, uses the first available pipeline."
                    },
                    "table_name": {
                        "type": "string",
                        "description": "Specific table name. If omitted, returns schema for all tables."
                    },
                    "include_hints": {
                        "type": "boolean",
                        "description": "Include dlt hints and annotations in the schema. Defaults to false."
                    }
                }
            }
        ),
        Tool(
            name="query_destination",
            description="Execute a read-only SQL SELECT query on the pipeline's destination database (DuckDB, PostgreSQL)",
            inputSchema={
                "type": "object",
                "properties": {
                    "pipeline_name": {
                        "type": "string",
                        "description": "Name of the pipeline. If omitted, uses the first available pipeline."
                    },
                    "query": {
                        "type": "string",
                        "description": "SQL SELECT query to execute. Only SELECT statements are allowed for safety."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of rows to return. Defaults to 100."
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="analyze_errors",
            description="Analyze pipeline load errors and explain root causes with suggested fixes",
            inputSchema={
                "type": "object",
                "properties": {
                    "pipeline_name": {
                        "type": "string",
                        "description": "Name of the pipeline. If omitted, uses the first available pipeline."
                    },
                    "last_n_runs": {
                        "type": "integer",
                        "description": "Number of recent runs to analyze. Defaults to 1."
                    }
                }
            }
        ),
        Tool(
            name="scaffold_pipeline",
            description="Generate scaffold code for a new dlt pipeline from a data source",
            inputSchema={
                "type": "object",
                "properties": {
                    "source_type": {
                        "type": "string",
                        "description": "Type of data source: 'rest_api', 'sql_database', 'filesystem'",
                        "enum": ["rest_api", "sql_database", "filesystem"]
                    },
                    "destination": {
                        "type": "string",
                        "description": "Destination database: 'duckdb', 'postgres', 'bigquery', etc.",
                        "enum": ["duckdb", "postgres", "bigquery", "snowflake"]
                    },
                    "pipeline_name": {
                        "type": "string",
                        "description": "Name for the new pipeline"
                    }
                },
                "required": ["source_type", "destination", "pipeline_name"]
            }
        ),
        Tool(
            name="review_schema_evolution",
            description="Review and summarize schema changes across pipeline runs",
            inputSchema={
                "type": "object",
                "properties": {
                    "pipeline_name": {
                        "type": "string",
                        "description": "Name of the pipeline. If omitted, uses the first available pipeline."
                    },
                    "compare_runs": {
                        "type": "integer",
                        "description": "Number of recent runs to compare. Defaults to 2."
                    }
                }
            }
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls."""
    try:
        if name == "inspect_pipeline":
            result = await inspect_pipeline(
                pipeline_name=arguments.get("pipeline_name"),
                working_dir=arguments.get("working_dir")
            )
        elif name == "get_schema":
            result = await get_schema(
                pipeline_name=arguments.get("pipeline_name"),
                table_name=arguments.get("table_name"),
                include_hints=arguments.get("include_hints", False)
            )
        elif name == "query_destination":
            result = await query_destination(
                pipeline_name=arguments.get("pipeline_name"),
                query=arguments.get("query"),
                limit=arguments.get("limit", 100)
            )
        elif name == "analyze_errors":
            result = await analyze_errors(
                pipeline_name=arguments.get("pipeline_name"),
                last_n_runs=arguments.get("last_n_runs", 1)
            )
        elif name == "scaffold_pipeline":
            result = await scaffold_pipeline(
                source_type=arguments.get("source_type"),
                destination=arguments.get("destination"),
                pipeline_name=arguments.get("pipeline_name")
            )
        elif name == "review_schema_evolution":
            result = await review_schema_evolution(
                pipeline_name=arguments.get("pipeline_name"),
                compare_runs=arguments.get("compare_runs", 2)
            )
        else:
            raise ValueError(f"Unknown tool: {name}")

        # Return result as JSON text content
        import json
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]

    except Exception as e:
        import json
        error_result = {
            "error": str(e),
            "error_type": type(e).__name__
        }
        return [TextContent(
            type="text",
            text=json.dumps(error_result, indent=2)
        )]


async def main():
    """Main entry point for the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())

