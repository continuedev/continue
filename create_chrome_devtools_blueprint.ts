#!/usr/bin/env node
/**
 * Create a Runloop Blueprint for Chrome DevTools MCP Development
 * Based on linux-setup.md instructions
 */

import { Runloop } from "@runloop/api-client";

async function createChromeDevToolsBlueprint() {
  // Initialize Runloop client
  const runloop = new Runloop();

  // Dockerfile based on Runloop base image with Chrome DevTools MCP setup
  const dockerfile = `FROM runloop:runloop/starter-arm64

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
`;

  // Create the blueprint
  console.log("Creating Chrome DevTools MCP blueprint...");
  const blueprint = await runloop.blueprints.create({
    name: "chrome-devtools-mcp",
    dockerfile: dockerfile,
    launch_parameters: {
      launch_commands: [
        // Start Xvfb on devbox launch
        "nohup Xvfb :99 -screen 0 1920x1080x24 > /tmp/xvfb.log 2>&1 &",
        // Wait for Xvfb to be ready
        "sleep 2",
      ],
    },
  });

  console.log(`Blueprint created with ID: ${blueprint.id}`);

  // Wait for blueprint to build (with timeout)
  console.log("Waiting for blueprint to build...");
  let info = await blueprint.get_info();
  const maxRetries = 60; // 5 minutes total (60 * 5 seconds)
  let retries = 0;

  while (info.status !== "build_complete" && info.status !== "build_failed") {
    if (retries >= maxRetries) {
      console.error("Blueprint build timed out after 5 minutes");
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    info = await blueprint.get_info();
    console.log(`Blueprint status: ${info.status}`);
    retries++;
  }

  if (info.status === "build_failed") {
    console.log("Blueprint build failed. Checking logs...");
    const logResult = await blueprint.logs();
    for (const log of logResult.logs) {
      console.log(`${log.level}: ${log.message}`);
    }
    return null;
  }

  console.log(`Blueprint build complete! ID: ${blueprint.id}`);
  console.log("\nTo create a devbox from this blueprint:");
  console.log(`const devbox = await blueprint.createDevbox();`);
  console.log(`// or`);
  console.log(
    `const devbox = await runloop.devboxes.create({ blueprint_id: "${blueprint.id}" });`,
  );

  return blueprint;
}

// Run if executed directly
if (require.main === module) {
  createChromeDevToolsBlueprint()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error creating blueprint:", error);
      process.exit(1);
    });
}

export { createChromeDevToolsBlueprint };
