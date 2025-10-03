#!/usr/bin/env node

// Test script to verify Sentry MCP connection
console.log(`
========================================
Sentry MCP Setup Guide
========================================

To set up Sentry MCP with Continue:

1. CONFIGURE CONTINUE:
   Open VS Code and add this to your Continue config:
   
   {
     "mcpServers": {
       "sentry": {
         "command": "npx",
         "args": ["@sentry/mcp-server@latest"],
         "type": "stdio"
       }
     }
   }

2. TEST THE CONNECTION:
   Run this command in your terminal:
   
   cn
   
   Then type:
   "Show me recent Sentry errors"

3. OAUTH AUTHENTICATION:
   - On first use, Sentry MCP will prompt for OAuth
   - Follow the browser authentication flow
   - Grant access to your Sentry organization

4. EXAMPLE QUERIES YOU CAN USE:

   a) View recent errors:
      "Show me Sentry errors from the past 24 hours"

   b) Analyze critical issues:
      "Find the most critical Sentry error affecting users in production"

   c) Performance analysis:
      "Analyze Sentry performance data for slow transactions"

   d) Create GitHub issues:
      "Analyze recent Sentry errors and create GitHub issues for critical bugs"

========================================
Alternative: Manual Setup with Auth Token
========================================

If OAuth doesn't work, you can use a Sentry auth token:

1. Get your Sentry auth token from:
   https://sentry.io/settings/account/api/auth-tokens/

2. Run the MCP server manually:
   npx @sentry/mcp-server@latest --access-token=YOUR_TOKEN --host=sentry.io

========================================
`);

// Check if Sentry MCP server is installed
const { exec } = require('child_process');
exec('npx @sentry/mcp-server@latest --version', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ Sentry MCP server not found. Installing...');
    exec('npm install -g @sentry/mcp-server@latest', (err, out, serr) => {
      if (err) {
        console.log('Error installing:', err.message);
      } else {
        console.log('✅ Sentry MCP server installed successfully!');
      }
    });
  } else {
    console.log('✅ Sentry MCP server is installed!');
    console.log('Version:', stdout.trim());
  }
});