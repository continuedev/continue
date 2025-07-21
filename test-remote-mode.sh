#!/bin/bash

echo "Remote Mode Testing Framework Demo"
echo "=================================="
echo ""
echo "This script demonstrates the new testing framework that runs TUI tests"
echo "in both normal and remote modes to ensure feature parity."
echo ""

# Run the basic tests
echo "1. Running basic TUI tests (both modes)..."
npm test -- src/ui/__tests__/TUIChat.basic.test.tsx --silent

echo ""
echo "2. Running message handling tests (both modes)..."
npm test -- src/ui/__tests__/TUIChat.messages.test.tsx --silent

echo ""
echo "3. Running remote-specific tests..."
npm test -- src/ui/__tests__/TUIChat.remote.test.tsx --silent

echo ""
echo "Testing framework features:"
echo "- ✅ Automatic test duplication for both modes"
echo "- ✅ Mock HTTP server for remote mode"
echo "- ✅ Helper functions for common operations"
echo "- ✅ Mode-specific test support"
echo "- ✅ Server state verification in remote mode"
echo ""
echo "See src/ui/__tests__/README.md for documentation"