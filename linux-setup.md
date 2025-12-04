# Chrome DevTools MCP Setup Guide for Headless Linux

This guide covers how to set up the Chrome DevTools MCP server on a headless Linux system, particularly for ARM64 architecture.

## Prerequisites

- Linux system (Debian/Ubuntu-based)
- Claude Code installed
- sudo access

## Installation Steps

### 1. Install Chromium Browser

On ARM64 Linux, Google Chrome is not officially supported, so we use Chromium instead:

```bash
sudo apt update
sudo apt install -y --no-install-recommends chromium chromium-driver
```

**Note:** We use `--no-install-recommends` to avoid Python version conflicts with the base system.

### 2. Create Symlink for Chrome DevTools MCP

The Chrome DevTools MCP looks for Chrome at `/opt/google/chrome/chrome`. Create a symlink to Chromium:

```bash
sudo mkdir -p /opt/google/chrome
sudo ln -s /usr/bin/chromium /opt/google/chrome/chrome
```

### 3. Install Xvfb (Virtual Display)

Since this is a headless system, we need a virtual display:

```bash
sudo apt install -y xvfb
```

### 4. Start Xvfb

Start Xvfb on display :99 with standard resolution:

```bash
Xvfb :99 -screen 0 1920x1080x24 &
```

**Note:** This needs to be running whenever you want to use Chrome DevTools MCP. You can add this to your shell startup script or create a systemd service for persistence.

## Usage

Once configured, you can use Chrome DevTools MCP tools:

### Open a webpage:

```
Use the chrome-devtools new_page tool to visit https://example.com
```

### Take a screenshot:

```
Use the chrome-devtools take_screenshot tool (saving it as a file)
```

### Resize browser window:

```
Use the chrome-devtools resize_page tool with width and height **1440x900** (MacBook, 16:10)
```

## Uploading Screenshots

To share screenshots from a headless system, you can use file sharing services:

```bash
# Upload to tmpfiles.org
curl -F "file=@/path/to/screenshot.png" https://tmpfiles.org/api/v1/upload
```

## Troubleshooting

### "Missing X server" error

- Make sure Xvfb is running: `ps aux | grep Xvfb`
- Verify the DISPLAY variable is set in your MCP config
- Restart Claude Code after config changes

### "Could not find Google Chrome executable" error

- Verify the symlink exists: `ls -la /opt/google/chrome/chrome`
- Make sure Chromium is installed: `which chromium`

### Architecture issues (x86_64 vs ARM64)

- Check your architecture: `uname -m`
- If ARM64 (aarch64), use Chromium instead of Chrome
- If x86_64, you can install Google Chrome directly from https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
