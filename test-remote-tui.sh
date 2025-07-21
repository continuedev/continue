#!/bin/bash

echo "Testing Remote TUI Mode"
echo "======================"
echo ""
echo "1. Starting local serve instance..."
npm run dev -- serve --port 8000 --timeout 60 &
SERVER_PID=$!

# Wait for server to start
sleep 5

echo ""
echo "2. Server should now be running at http://localhost:8000"
echo ""
echo "3. In another terminal, you can now test the remote TUI with:"
echo "   npm run dev -- remote-test 'Hello from remote mode!'"
echo ""
echo "   This will connect to the local server and you'll see:"
echo "   - The input border will be cyan instead of gray"
echo "   - The prompt icon will be ◉ instead of ●"
echo "   - 'Remote Mode' will be shown at the bottom"
echo ""
echo "Press Ctrl+C to stop the server..."

# Wait for the server
wait $SERVER_PID