#!/usr/bin/env python3
"""
Create a Runloop Blueprint for Chrome DevTools MCP Development
Based on linux-setup.md instructions
"""

import time
from runloop_api_client import Runloop

def create_chrome_devtools_blueprint():
    """Create a blueprint with Chrome DevTools MCP setup"""

    # Initialize Runloop client
    runloop = Runloop()

    # Dockerfile based on Runloop base image with Chrome DevTools MCP setup
    dockerfile = """FROM runloop:runloop/starter-arm64

# Set up display for headless operation
ENV DISPLAY=:99

# Install system dependencies (including base blueprint tools)
RUN apt-get update && apt-get install -y --no-install-recommends \\
    chromium \\
    chromium-driver \\
    xvfb \\
    curl \\
    ca-certificates \\
    ripgrep \\
    && rm -rf /var/lib/apt/lists/*

# Install Continue CLI
RUN npm i -g @continuedev/cli@latest

# Create symlink for Chrome DevTools MCP
# The MCP looks for Chrome at /opt/google/chrome/chrome
RUN mkdir -p /opt/google/chrome && \\
    ln -s /usr/bin/chromium /opt/google/chrome/chrome

# Create a startup script to run Xvfb
RUN echo '#!/bin/bash\\n\\
# Start Xvfb in the background\\n\\
Xvfb :99 -screen 0 1920x1080x24 &\\n\\
# Wait a moment for Xvfb to start\\n\\
sleep 2' > /home/user/start-xvfb.sh && \\
    chmod +x /home/user/start-xvfb.sh

WORKDIR /home/user
"""

    # Create the blueprint
    print("Creating Chrome DevTools MCP blueprint...")
    blueprint = runloop.blueprints.create(
        name="chrome-devtools-mcp",
        dockerfile=dockerfile,
        launch_parameters={
            "launch_commands": [
                # Start Xvfb on devbox launch
                "nohup Xvfb :99 -screen 0 1920x1080x24 > /tmp/xvfb.log 2>&1 &",
                # Wait for Xvfb to be ready
                "sleep 2"
            ]
        }
    )

    print(f"Blueprint created with ID: {blueprint.id}")

    # Wait for blueprint to build (with timeout)
    print("Waiting for blueprint to build...")
    max_retries = 60  # 5 minutes total (60 * 5 seconds)
    retries = 0

    while blueprint.status not in ["ready", "failed"]:
        if retries >= max_retries:
            raise TimeoutError("Blueprint build timed out after 5 minutes")
        time.sleep(5)
        # Refresh blueprint info
        blueprints = runloop.blueprints.list()
        for bp in blueprints:
            if bp.id == blueprint.id:
                blueprint = bp
                break
        print(f"Blueprint status: {blueprint.status}")
        retries += 1

    if blueprint.status == "failed":
        print("Blueprint build failed. Checking logs...")
        log_result = runloop.blueprints.logs(blueprint.id)
        for log in log_result.logs:
            print(f"{log.level}: {log.message}")
        raise RuntimeError("Blueprint build failed")

    print(f"Blueprint build complete! ID: {blueprint.id}")
    print("\nTo create a devbox from this blueprint:")
    print(f'devbox = blueprint.create_devbox()')
    print(f'# or')
    print(f'devbox = runloop.devboxes.create(blueprint_id="{blueprint.id}")')

    return blueprint

if __name__ == "__main__":
    try:
        create_chrome_devtools_blueprint()
    except Exception as e:
        print(f"Error creating blueprint: {e}")
        exit(1)
