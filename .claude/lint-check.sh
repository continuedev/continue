#!/bin/bash

# Get file path from hook input
FILE_PATH=$(cat | jq -r '.tool_input.file_path // .tool_input.edits[].file_path // empty' | head -n1)

# Function to run lint and typecheck
run_checks() {
    local dir=$1
    cd "$dir"
    npm run lint >&2 && npm run tsc:check >&2
}

# Run checks based on file location
if [[ "$FILE_PATH" == *"/core/"* ]]; then
    run_checks core
elif [[ "$FILE_PATH" == *"/gui/"* ]]; then
    run_checks gui  
elif [[ "$FILE_PATH" == *"/extensions/vscode/"* ]]; then
    run_checks extensions/vscode
fi