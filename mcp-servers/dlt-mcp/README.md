# dlt MCP Server

Model Context Protocol (MCP) server for [dlt](https://dlthub.com) (data load tool). This server enables AI agents to inspect, debug, and explore local dlt pipelines through safe, read-only tooling.

## Features

- **Pipeline Inspection**: View execution details, timing, file sizes, and rows loaded
- **Schema Metadata**: Retrieve table schemas, columns, data types, and constraints
- **Data Querying**: Execute read-only SQL queries on destination databases (DuckDB, PostgreSQL)
- **Error Analysis**: Analyze load errors with root cause explanations and suggested fixes
- **Pipeline Scaffolding**: Generate starter code for new dlt pipelines
- **Schema Evolution**: Review schema changes across pipeline runs

## Prerequisites

- Python 3.8 or higher
- dlt library installed (`pip install dlt`)
- A dlt pipeline project (or create one using the scaffold tool)

## Installation

### Using uvx (Recommended)

```bash
# The server can be run directly with uvx
uvx dlt-mcp
```

### From Source

```bash
# Clone or navigate to the mcp-servers/dlt-mcp directory
cd mcp-servers/dlt-mcp

# Install in development mode
pip install -e .

# Or install dependencies only
pip install -r requirements.txt
```

## Configuration

Add the dlt MCP server to your Continue configuration:

### YAML Configuration

```yaml
name: dlt MCP Server
version: 0.1.0
schema: v1
mcpServers:
  - name: dlt-mcp
    command: uvx
    args:
      - "dlt-mcp"
```

### JSON Configuration (Claude Desktop, Cursor, etc.)

```json
{
  "mcpServers": {
    "dlt-mcp": {
      "command": "uvx",
      "args": ["dlt-mcp"]
    }
  }
}
```

### With Custom Working Directory

```yaml
mcpServers:
  - name: dlt-mcp
    command: uvx
    args:
      - "dlt-mcp"
    env:
      DLT_WORKING_DIR: "/path/to/your/pipelines"
```

## Available Tools

### 1. `inspect_pipeline`

Inspect dlt pipeline execution details including load info, timing, file sizes, and rows loaded.

**Parameters:**
- `pipeline_name` (optional): Name of the pipeline to inspect. If omitted, auto-discovers pipelines.
- `working_dir` (optional): Directory to search for pipelines. Defaults to current working directory.

**Example:**
```json
{
  "pipeline_name": "my_pipeline",
  "working_dir": "/path/to/pipelines"
}
```

**Output:**
```json
{
  "pipeline": {
    "name": "my_pipeline",
    "destination": "duckdb",
    "dataset_name": "my_pipeline_data"
  },
  "loads": [
    {
      "load_id": "1234567890",
      "status": "completed",
      "started_at": "2024-01-01T00:00:00Z",
      "finished_at": "2024-01-01T00:05:00Z",
      "duration_seconds": 300.0
    }
  ],
  "file_sizes": {
    "loads/1234567890/users.parquet": 1024000
  },
  "rows_loaded": {
    "users": 1000
  }
}
```

---

### 2. `get_schema`

Retrieve pipeline schema metadata including tables, columns, data types, and constraints.

**Parameters:**
- `pipeline_name` (optional): Name of the pipeline. If omitted, uses first available pipeline.
- `table_name` (optional): Specific table name. If omitted, returns schema for all tables.
- `include_hints` (optional): Include dlt hints and annotations. Defaults to false.

**Example:**
```json
{
  "pipeline_name": "my_pipeline",
  "table_name": "users",
  "include_hints": true
}
```

**Output:**
```json
{
  "pipeline_name": "my_pipeline",
  "tables": [
    {
      "name": "users",
      "resource_name": "users",
      "columns": [
        {
          "name": "id",
          "data_type": "bigint",
          "nullable": false,
          "primary_key": true,
          "hints": {
            "unique": true
          }
        },
        {
          "name": "email",
          "data_type": "text",
          "nullable": true,
          "primary_key": false
        }
      ]
    }
  ],
  "table_count": 1
}
```

---

### 3. `query_destination`

Execute a read-only SQL SELECT query on the pipeline's destination database.

**Parameters:**
- `pipeline_name` (optional): Name of the pipeline. If omitted, uses first available pipeline.
- `query` (required): SQL SELECT query to execute. Only SELECT statements are allowed.
- `limit` (optional): Maximum number of rows to return. Defaults to 100.

**Example:**
```json
{
  "pipeline_name": "my_pipeline",
  "query": "SELECT * FROM users WHERE created_at > '2024-01-01' LIMIT 10",
  "limit": 10
}
```

**Output:**
```json
{
  "pipeline_name": "my_pipeline",
  "query": "SELECT * FROM users WHERE created_at > '2024-01-01' LIMIT 10",
  "columns": ["id", "name", "email", "created_at"],
  "rows": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "row_count": 1,
  "limit_applied": 10
}
```

**Safety:** Only SELECT statements are allowed. The tool validates queries to prevent INSERT, UPDATE, DELETE, DROP, and other mutation operations.

---

### 4. `analyze_errors`

Analyze pipeline load errors and explain root causes with suggested fixes.

**Parameters:**
- `pipeline_name` (optional): Name of the pipeline. If omitted, uses first available pipeline.
- `last_n_runs` (optional): Number of recent runs to analyze. Defaults to 1.

**Example:**
```json
{
  "pipeline_name": "my_pipeline",
  "last_n_runs": 3
}
```

**Output:**
```json
{
  "pipeline_name": "my_pipeline",
  "errors": [
    {
      "error_type": "TypeError",
      "message": "Cannot cast string to integer",
      "table_name": "users",
      "load_id": "1234567890",
      "suggested_fix": "Check data types in source data. Consider adding data type hints in your pipeline schema."
    }
  ],
  "error_count": 1,
  "last_n_runs_checked": 3
}
```

---

### 5. `scaffold_pipeline`

Generate scaffold code for a new dlt pipeline from a data source.

**Parameters:**
- `source_type` (required): Type of data source. Options: `"rest_api"`, `"sql_database"`, `"filesystem"`.
- `destination` (required): Destination database. Options: `"duckdb"`, `"postgres"`, `"bigquery"`, `"snowflake"`.
- `pipeline_name` (required): Name for the new pipeline.

**Example:**
```json
{
  "source_type": "rest_api",
  "destination": "duckdb",
  "pipeline_name": "my_new_pipeline"
}
```

**Output:**
```json
{
  "pipeline_name": "my_new_pipeline",
  "source_type": "rest_api",
  "destination": "duckdb",
  "code": {
    "main_file": "my_new_pipeline_pipeline.py",
    "content": "# Generated pipeline code...",
    "description": "REST API pipeline scaffold for my_new_pipeline"
  },
  "file_structure": {
    "files": [
      "my_new_pipeline_pipeline.py",
      ".dlt/secrets.toml",
      ".dlt/config.toml",
      "requirements.txt"
    ],
    "directories": [".dlt/", "data/"]
  },
  "next_steps": [
    "1. Create the pipeline file: my_new_pipeline_pipeline.py",
    "2. Add API credentials to .dlt/secrets.toml",
    "3. Configure destination credentials in .dlt/secrets.toml",
    "4. Install dependencies: pip install dlt",
    "5. Run the pipeline: python my_new_pipeline_pipeline.py"
  ]
}
```

---

### 6. `review_schema_evolution`

Review and summarize schema changes across pipeline runs.

**Parameters:**
- `pipeline_name` (optional): Name of the pipeline. If omitted, uses first available pipeline.
- `compare_runs` (optional): Number of recent runs to compare. Defaults to 2.

**Example:**
```json
{
  "pipeline_name": "my_pipeline",
  "compare_runs": 3
}
```

**Output:**
```json
{
  "pipeline_name": "my_pipeline",
  "evolution": [
    {
      "table_name": "users",
      "added_columns": [
        {
          "name": "last_login",
          "data_type": "timestamp",
          "nullable": true,
          "primary_key": false
        }
      ],
      "removed_columns": [],
      "modified_columns": [],
      "type_changes": []
    }
  ],
  "compare_runs": 3,
  "summary": {
    "tables_changed": 1,
    "total_added_columns": 1,
    "total_removed_columns": 0,
    "total_type_changes": 0
  }
}
```

## Supported Destinations

The server supports querying data from the following destination databases:

- **DuckDB**: Local file-based database (default for local development)
- **PostgreSQL**: Requires `psycopg2-binary` package
- **BigQuery**: (Schema inspection supported, querying requires additional setup)
- **Snowflake**: (Schema inspection supported, querying requires additional setup)

## Safety Features

- **Read-only queries**: SQL validation ensures only SELECT statements are executed
- **Query sanitization**: Dangerous keywords (INSERT, UPDATE, DELETE, DROP, etc.) are blocked
- **Connection limits**: Query results are limited by default (configurable)
- **Error handling**: Comprehensive error messages with suggested fixes

## Development

### Running Tests

```bash
# Install test dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with coverage
pytest --cov=dlt_mcp --cov-report=html
```

### Code Formatting

```bash
# Format code with black
black src/

# Lint with ruff
ruff check src/
```

## Troubleshooting

### Pipeline Not Found

If the server cannot find your pipeline:

1. Ensure you're running the server from the correct working directory
2. Check that your pipeline has been run at least once (creates `.dlt/` directory)
3. Verify the pipeline name matches exactly (case-sensitive)

### Destination Connection Issues

If querying the destination fails:

1. Verify database credentials are configured in `.dlt/secrets.toml`
2. For PostgreSQL, ensure `psycopg2-binary` is installed
3. Check network connectivity for remote databases
4. Verify the pipeline has successfully loaded data to the destination

### Query Validation Errors

If queries are rejected:

1. Ensure queries start with `SELECT`
2. Remove any INSERT, UPDATE, DELETE, or other mutation statements
3. Check for SQL comments that might interfere with validation

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Related Resources

- [dlt Documentation](https://dlthub.com/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Continue.dev Documentation](https://docs.continue.dev)

