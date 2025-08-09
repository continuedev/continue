# Continue CLI Command Line Options

Quick reference for using `cn` command line options.

## Basic Usage

```bash
cn                              # Start interactive chat
cn "analyze my code"            # Chat with prompt
cn -p "review this file"        # Print response and exit (headless)
```

## Configuration

- `--config <path>` - Use specific config file
- `--verbose` - Show detailed logging

```bash
cn --config ./my-config.yaml
cn --verbose -p "debug this issue"
```

## Permission Modes

- `--readonly` - Only allow read operations (safe mode)
- `--auto` - Allow all tools without asking (careful!)

```bash
cn --readonly -p "analyze the codebase"     # Safe: can't modify files
cn --auto -p "fix the failing tests"        # Dangerous: will modify files
```

## Fine-grained Permissions

- `--allow <tool>` - Allow specific tools
- `--ask <tool>` - Ask before using tools
- `--exclude <tool>` - Block specific tools

```bash
cn --allow readFile --allow searchCode -p "find todos"
cn --exclude Write -p "help me understand this code"  # Can't modify files
cn --ask writeFile -p "suggest fixes"                 # Will ask before writing
```

## Headless Mode (for scripts)

Use `-p` for non-interactive output:

```bash
cn -p "summarize the main function"
echo "error log" | cn -p "what caused this error?"
cn -p --format json "list main files" | jq '.response'
cn -p --silent "get summary" | grep -v "^$"          # Clean output
```

## Server Mode

Run Continue as a server:

```bash
cn serve                        # Start server on port 8000
cn serve --port 3000            # Custom port
cn serve --timeout 600          # 10 minute timeout
```

## Remote Development

```bash
cn remote "help debug this"                    # Create new remote environment
cn remote --url https://my-server.com "work"   # Connect to existing server
cn remote --idempotency-key my-session "work"  # Resume or create idempotent session
```

### Idempotent Sessions

Use `--idempotency-key` to create resumable remote sessions:

```bash
# First time - creates new session
cn remote --idempotency-key "project-review" "start code review"

# Later - resumes same session if it exists
cn remote --idempotency-key "project-review" "continue where we left off"

# Different key - creates separate session
cn remote --idempotency-key "feature-dev" "work on new feature"
```

The backend manages session lifecycle based on the idempotency key:

- New key = new remote environment
- Existing key = connect to existing session
- Sessions may expire based on backend configuration

### Repository Detection

The `cn remote` command automatically detects your repository URL:

- **GitHub Actions**: Uses `GITHUB_REPOSITORY` and `GITHUB_SERVER_URL` environment variables
- **Git Repository**: Uses `git remote get-url origin`
- **Fallback**: Uses current working directory path

This ensures the remote environment is created with the correct repository context.

## Common Examples

```bash
# Safe code analysis
cn --readonly -p "review my git diff"

# Let AI fix tests (with permission)
cn --ask writeFile -p "fix failing tests"

# Scripted code review
git diff | cn -p "review this change" --format json

# Remote pair programming
cn remote "help me implement user auth"

# Run as code review server
cn serve --readonly --port 8080
```

## Notes

- Use `--readonly` when you want AI to analyze but not modify code
- Use `--auto` only when you trust the AI to make changes
- Pipe input works: `cat file.py | cn -p "explain this"`
- `--format json` and `--silent` only work with `-p`
