#!/bin/bash

# Timeout for waiting for Ollama to start (in seconds)
readonly TIMEOUT=60
readonly OLLAMA_API_URL="http://localhost:11434/api/version"

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Ollama is already running
ollama_is_running() {
    VERSION=$(curl -s --fail --max-time 1 "$OLLAMA_API_URL" | grep '"version"' | awk -F: '{ print $2 }' | sed -e 's/.*"\([^"]*\)".*/\1/')
    test -n "$VERSION"
}

# Determine if running in a container environment
in_container() {
    [[ -f /.dockerenv || -f /run/.containerenv ]]
}

# Start Ollama service or background process
start_ollama() {
    local start_method="${1:-background}"
    echo "Starting Ollama ($start_method)..."

    if [[ "$start_method" == "service" ]]; then
        if in_container; then
            service ollama start || return $?
        else
            sudo systemctl start ollama || return $?
        fi
    else
        nohup ollama serve >/dev/null 2>&1 &
    fi

    # Wait for Ollama to start. TIMEOUT * 4, since we sleep 1/4 sec on each iteration 
    for _ in $(seq 1 $((TIMEOUT * 4))); do
        if ollama_is_running; then
            echo -e "\nOllama started successfully."
            return 0
        fi
        (( _ % 2 == 0 )) && printf "."
        sleep 0.25
    done

    echo -e "\nTimeout: Failed to start Ollama."
    return 1
}

# Main script execution
main() {
    # Early exit if Ollama is already running
    if ollama_is_running; then
        echo "Ollama is already running."
        return 0
    fi

    # Try starting via service if possible
    if in_container; then
        if service --status-all 2>&1 | grep -qw 'ollama'; then
            start_ollama service || return $?
            return 0
        fi
    elif command_exists systemctl; then
        if systemctl list-unit-files ollama.service >/dev/null 2>&1; then
            start_ollama service || return $?
            return 0
        fi
    fi

    # Fallback to background process
    if command_exists ollama; then
        start_ollama || return 1
    else
        echo "Error: Ollama is not installed or not in the PATH." >&2
        return 1
    fi
}

# Run the main function and exit with its status
main
exit $?
