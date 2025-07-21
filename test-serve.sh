#!/bin/bash

echo "Testing the cn serve command"
echo "============================"
echo ""
echo "1. Starting server with initial prompt in the background..."
npm run dev -- serve "What is the capital of France?" --timeout 10 &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "2. Checking server state..."
curl -s http://localhost:8000/state | jq .

echo ""
echo "3. Sending a message..."
curl -s -X POST http://localhost:8000/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2+2?"}' | jq .

# Wait for response to process
sleep 3

echo ""
echo "4. Checking state after message..."
curl -s http://localhost:8000/state | jq .

echo ""
echo "5. Server will shut down after 10 seconds of inactivity..."
echo "(You can send more messages with: curl -X POST http://localhost:8000/message -H 'Content-Type: application/json' -d '{\"message\": \"Your message here\"}')"

# Wait for the server process to complete
wait $SERVER_PID