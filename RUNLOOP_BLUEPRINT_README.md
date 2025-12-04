# Chrome DevTools MCP Runloop Blueprint

This directory contains scripts to create a Runloop Blueprint for Chrome DevTools MCP development in headless Linux environments.

## What This Blueprint Provides

The blueprint creates a pre-configured development environment with:

### Base Tools (from existing blueprint)

- **Continue CLI**: `@continuedev/cli` installed globally
- **ripgrep**: Fast search tool

### Chrome DevTools MCP Setup

- **Chromium Browser**: For web automation and testing
- **ChromeDriver**: For Selenium/WebDriver support
- **Xvfb**: Virtual display server for headless operation
- **Symlink Configuration**: Chrome DevTools MCP expects Chrome at `/opt/google/chrome/chrome`, symlinked to Chromium
- **Environment Setup**: `DISPLAY=:99` pre-configured
- **Auto-start Xvfb**: Virtual display automatically starts when devbox launches

## Files

- `create_chrome_devtools_blueprint.py` - Python script to create the blueprint
- `create_chrome_devtools_blueprint.ts` - TypeScript script to create the blueprint
- `Dockerfile.devbox` - Original Docker configuration (for reference)
- `linux-setup.md` - Manual setup guide (for reference)

## Prerequisites

- Runloop API access and credentials
- Python 3.7+ (for Python script) or Node.js (for TypeScript script)
- Runloop SDK installed:
  - Python: `pip install runloop-api-client`
  - TypeScript: `npm install @runloop/api-client`

## Usage

### Python

```bash
# Make executable
chmod +x create_chrome_devtools_blueprint.py

# Run the script
python create_chrome_devtools_blueprint.py
```

### TypeScript

```bash
# Make executable
chmod +x create_chrome_devtools_blueprint.ts

# Run the script
npx ts-node create_chrome_devtools_blueprint.ts
# or if using plain JavaScript
node create_chrome_devtools_blueprint.js
```

### Creating a Devbox from the Blueprint

Once the blueprint is created, you can launch devboxes with:

**Python:**

```python
from runloop_api_client import Runloop

runloop = Runloop()

# By blueprint name (gets latest version)
devbox = await runloop.devboxes.create(
    blueprint_name="chrome-devtools-mcp"
)

# By blueprint ID (for specific version)
devbox = await runloop.devboxes.create(
    blueprint_id="bpt_xxxxx"
)
```

**TypeScript:**

```typescript
import { Runloop } from "@runloop/api-client";

const runloop = new Runloop();

// By blueprint name (gets latest version)
const devbox = await runloop.devboxes.create({
  blueprint_name: "chrome-devtools-mcp",
});

// By blueprint ID (for specific version)
const devbox = await runloop.devboxes.create({
  blueprint_id: "bpt_xxxxx",
});
```

## Using Chrome DevTools MCP in the Devbox

Once your devbox is running, Xvfb will already be started. You can use Chrome DevTools MCP tools immediately:

### Open a webpage

```bash
# Use MCP tool or direct chromium command
chromium --headless --disable-gpu --screenshot=screenshot.png https://example.com
```

### Take a screenshot

```bash
chromium --headless --disable-gpu --screenshot=screenshot.png --window-size=1440,900 https://example.com
```

### Upload screenshots

```bash
# Upload to tmpfiles.org for sharing
curl -F "file=@screenshot.png" https://tmpfiles.org/api/v1/upload
```

## Blueprint Architecture

The blueprint is based on `runloop:runloop/starter-arm64` and includes:

1. **System Packages**: Installs via `apt-get`

   - chromium-browser
   - chromium-chromedriver
   - xvfb
   - curl
   - ca-certificates
   - ripgrep

2. **NPM Global Packages**:

   - @continuedev/cli@latest

3. **Configuration**:

   - Creates `/opt/google/chrome/chrome` symlink
   - Sets `DISPLAY=:99` environment variable
   - Creates startup script at `/home/user/start-xvfb.sh`

4. **Launch Commands**:
   - Starts Xvfb in background on devbox creation
   - Waits for Xvfb to be ready

## Troubleshooting

### Blueprint Build Failed

Check the build logs:

```python
blueprint = await runloop.blueprints.from_id("bpt_xxxxx")
log_result = await blueprint.logs()
for log in log_result.logs:
    print(f"{log.level}: {log.message}")
```

### Xvfb Not Running in Devbox

Manually start Xvfb:

```bash
Xvfb :99 -screen 0 1920x1080x24 &
```

Or use the startup script:

```bash
/home/user/start-xvfb.sh
```

### Chrome/Chromium Not Found

Verify the symlink:

```bash
ls -la /opt/google/chrome/chrome
which chromium-browser
```

## Blueprint Updates

To update the blueprint:

1. Modify the Dockerfile string in the script
2. Run the script again (it will create a new version)
3. Optionally delete old versions to save storage costs

Example cleanup:

```python
# Get all blueprints with this name
blueprints = await runloop.blueprints.list(name='chrome-devtools-mcp')

# Keep only the newest, delete the rest
sorted_blueprints = sorted(blueprints, key=lambda x: x.created_at, reverse=True)
for old_blueprint in sorted_blueprints[1:]:
    await old_blueprint.delete()
```

## Cost Optimization

- Blueprints persist indefinitely and incur storage costs
- Delete unused blueprint versions regularly
- Use blueprint names instead of IDs to always get the latest version

## Related Documentation

- [Runloop Blueprints Documentation](https://docs.runloop.ai/devboxes/blueprints)
- [Chrome DevTools MCP Setup Guide](./linux-setup.md)
- [Runloop SDK Reference](https://docs.runloop.ai/)
