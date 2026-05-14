#!/usr/bin/env bash

podman run --rm -e CONTINUE_VSCODE_TARGET=darwin-arm64 -v "$(pwd)":/workspace continue-vscode-builder