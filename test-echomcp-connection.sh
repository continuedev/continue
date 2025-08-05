#!/bin/bash

echo "🔍 Testing EchoMCP Connection..."
echo ""

# Test 1: Check if EchoMCP server is running
echo "1. Testing EchoMCP server health..."
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo "   ✅ EchoMCP server is running and healthy"
else
    echo "   ❌ EchoMCP server is not responding"
    exit 1
fi

# Test 2: Check available models
echo ""
echo "2. Testing available models..."
MODELS=$(curl -s http://localhost:8000/v1/models)
if echo "$MODELS" | grep -q "echo-mcp"; then
    echo "   ✅ EchoMCP model is available"
    echo "   📋 Models: $MODELS"
else
    echo "   ❌ EchoMCP model not found"
    echo "   📋 Response: $MODELS"
fi

# Test 3: Test chat completion
echo ""
echo "3. Testing chat completion..."
RESPONSE=$(curl -s -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "echo-mcp",
    "messages": [{"role": "user", "content": "Hello, are you EchoMCP?"}],
    "max_tokens": 50,
    "stream": false
  }')

if echo "$RESPONSE" | grep -q "EchoMCP"; then
    echo "   ✅ Chat completion is working"
    echo "   💬 Response preview: $(echo "$RESPONSE" | head -c 100)..."
else
    echo "   ❌ Chat completion failed or unexpected response"
    echo "   📋 Response: $RESPONSE"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Open VS Code (should already be open)"
echo "2. Look for the Continue icon in the left sidebar"
echo "3. Press Ctrl+L to open Continue chat"
echo "4. Type 'Hello, are you EchoMCP?' to test the connection"
echo ""
echo "📁 Configuration files:"
echo "   - ~/.continue/config.json (JSON format)"
echo "   - ~/.continue/config.yaml (YAML format)"
echo ""
echo "🔧 If Continue still doesn't connect to EchoMCP:"
echo "   - Press Ctrl+Shift+P in VS Code"
echo "   - Type 'Developer: Reload Window'"
echo "   - Try the chat again"
