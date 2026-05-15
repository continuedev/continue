#!/usr/bin/env bash

podman run --rm -e CONTINUE_VSCODE_TARGET=darwin-arm64 -e SKIP_TESTS=1 -v "$(pwd)":/workspace continue-vscode-builder