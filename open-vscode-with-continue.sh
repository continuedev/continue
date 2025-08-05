#!/bin/bash

echo "🚀 Opening VS Code with Continue extension..."
echo ""
echo "📍 How to find the Continue extension:"
echo "1. Look for a 'Continue' icon in the left sidebar (Activity Bar)"
echo "2. If you don't see it, try these steps:"
echo "   - Press Ctrl+Shift+P (Cmd+Shift+P on Mac)"
echo "   - Type 'Continue: Focus Continue Chat'"
echo "   - Press Enter"
echo ""
echo "3. Alternative ways to access Continue:"
echo "   - Press Ctrl+L (Cmd+L on Mac) to open Continue chat"
echo "   - Press Ctrl+I (Cmd+I on Mac) to edit code with Continue"
echo ""
echo "4. If still not visible:"
echo "   - Go to View > Extensions"
echo "   - Search for 'Continue'"
echo "   - Make sure it's enabled"
echo ""
echo "🔧 Your MCP server should be running on: http://localhost:8000"
echo "📁 Configuration file: ~/.continue/config.json"
echo ""

# Open VS Code
code .

echo "✅ VS Code opened. Look for the Continue icon in the sidebar!"
