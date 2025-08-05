#!/bin/bash

echo "🚀 Opening VS Code with Echo DevCon extension..."
echo ""
echo "📍 How to find the Echo DevCon extension:"
echo "1. Look for the 'Echo DevCon' icon in the left sidebar (Activity Bar)"
echo "2. If you don't see it, try these steps:"
echo "   - Press Ctrl+Shift+P (Cmd+Shift+P on Mac)"
echo "   - Type 'Echo DevCon: Focus Chat'"
echo "   - Press Enter"
echo ""
echo "3. Alternative ways to access Echo DevCon:"
echo "   - Press Ctrl+L (Cmd+L on Mac) to open Echo DevCon chat"
echo "   - Press Ctrl+I (Cmd+I on Mac) to edit code with Echo DevCon"
echo ""
echo "4. If still not visible:"
echo "   - Go to View > Extensions"
echo "   - Search for 'Echo DevCon'"
echo "   - Make sure it's enabled"
echo ""
echo "🔧 Your MCP server should be running on: http://localhost:8000"
echo "📁 Configuration file: ~/.continue/config.json"
echo ""

# Open VS Code
code .

echo "✅ VS Code opened. Look for the Continue icon in the sidebar!"
