#!/bin/bash

# EchoMCP + Echo-DevCon Setup Script
# This script sets up the echo-devcon extension with the echomcp backend

set -e

echo "🚀 Setting up EchoMCP + Echo-DevCon..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the echo-devcon root directory"
    exit 1
fi

print_status "Building Echo-DevCon extension..."

# Build the extension
cd extensions/vscode
npm install
npm run esbuild

print_status "Building GUI..."
cd ../../gui
npm install
npm run build

print_status "Packaging extension..."
cd ../extensions/vscode
npm run package

print_success "Extension built successfully!"

# Create configuration directory
print_status "Setting up configuration..."
mkdir -p ~/.continue

# Create the configuration file
cat > ~/.continue/config.json << 'EOF'
{
  "models": [
    {
      "title": "EchoMCP",
      "provider": "openai",
      "model": "echo-mcp",
      "apiBase": "http://localhost:8000/v1",
      "requestOptions": {
        "headers": {
          "Content-Type": "application/json"
        },
        "timeout": 7200
      }
    }
  ],
  "defaultModel": "EchoMCP",
  "contextProviders": [
    {
      "name": "http",
      "params": {
        "url": "http://localhost:8000/chat",
        "title": "EchoMCP Context",
        "description": "Get context from EchoMCP backend",
        "displayTitle": "EchoMCP"
      }
    },
    {
      "name": "file"
    },
    {
      "name": "codebase"
    },
    {
      "name": "diff"
    }
  ],
  "rules": [
    "You are EchoMCP, a helpful AI assistant connected to the EchoMCP backend.",
    "Always provide clear and concise responses.",
    "When asked about your capabilities, mention that you're connected to the EchoMCP backend running on localhost:8000.",
    "Use the EchoMCP backend for all chat interactions and context retrieval."
  ],
  "ui": {
    "displayRawMarkdown": false
  }
}
EOF

print_success "Configuration created at ~/.continue/config.json"

# Setup EchoMCP backend
print_status "Setting up EchoMCP backend..."

cd ../../../echomcp

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
print_status "Installing Python dependencies..."
source venv/bin/activate
pip install fastapi uvicorn

print_success "EchoMCP backend dependencies installed!"

# Create startup script for the backend
cat > start-echomcp.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
export PYTHONPATH="$(pwd)"
python3 -m uvicorn backend.core.main:app --host 0.0.0.0 --port 8000 --reload
EOF

chmod +x start-echomcp.sh

print_success "EchoMCP startup script created!"

# Create installation script for the extension
cat > install-extension.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/../echo-devcon/extensions/vscode"
code --install-extension build/continue-1.1.72.vsix
EOF

chmod +x install-extension.sh

print_success "Extension installation script created!"

# Create a comprehensive README
cat > README-ECHO-DEVCON.md << 'EOF'
# EchoMCP + Echo-DevCon Setup

This setup provides a seamless integration between the Echo-DevCon VSCode extension and the EchoMCP backend.

## Components

1. **Echo-DevCon Extension**: A fork of Continue.dev that connects to the EchoMCP backend
2. **EchoMCP Backend**: A FastAPI-based backend that provides OpenAI-compatible endpoints

## Quick Start

### 1. Start the EchoMCP Backend

```bash
cd echomcp
./start-echomcp.sh
```

The backend will be available at `http://localhost:8000`

### 2. Install the Extension

```bash
cd echomcp
./install-extension.sh
```

Or manually install the VSIX file:
```bash
code --install-extension echo-devcon/extensions/vscode/build/continue-1.1.72.vsix
```

### 3. Configure VSCode

The extension is configured to connect to the EchoMCP backend automatically. The configuration is stored in `~/.continue/config.json`.

## Features

- **OpenAI-Compatible API**: The EchoMCP backend provides OpenAI-compatible endpoints
- **Real-time Chat**: Connect to the backend for chat interactions
- **Context Providers**: Access file, codebase, and diff context
- **Streaming Responses**: Real-time streaming of responses from the backend

## API Endpoints

- `GET /health` - Health check
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions (OpenAI-compatible)
- `POST /chat` - Legacy chat endpoint
- `GET /agent/status` - Agent status
- `POST /agent/invoke` - Invoke agent tasks

## Configuration

The extension is configured to use:
- **Model**: EchoMCP (echo-mcp)
- **API Base**: http://localhost:8000/v1
- **Context Providers**: HTTP, File, Codebase, Diff

## Troubleshooting

1. **Backend not starting**: Check if port 8000 is available
2. **Extension not connecting**: Verify the backend is running and accessible
3. **Configuration issues**: Check `~/.continue/config.json`

## Development

To modify the backend:
1. Edit files in `echomcp/backend/`
2. Restart the backend with `./start-echomcp.sh`

To modify the extension:
1. Edit files in `echo-devcon/extensions/vscode/src/`
2. Run `npm run esbuild` to rebuild
3. Run `npm run package` to create a new VSIX

## License

This is a fork of Continue.dev with custom EchoMCP integration.
EOF

print_success "Documentation created!"

print_success "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the EchoMCP backend: cd echomcp && ./start-echomcp.sh"
echo "2. Install the extension: cd echomcp && ./install-extension.sh"
echo "3. Open VSCode and start using Echo-DevCon!"
echo ""
echo "For more information, see README-ECHO-DEVCON.md" 