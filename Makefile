# ---------
# Globals
# ---------
SHELL := /bin/bash
NODE_HEAP_MB ?= 4096
export NODE_OPTIONS := --max-old-space-size=$(NODE_HEAP_MB)

ROOT := $(shell pwd)
CORE_DIR := core
GUI_DIR := gui
VSCODE_DIR := extensions/vscode
VSIX := $(VSCODE_DIR)/build/continue-*.vsix

.DEFAULT_GOAL := build

# ---------
# Build
# ---------
.PHONY: build
build: build-core build-gui package

.PHONY: build-core
build-core:
	@echo "==> Building core"
	cd $(CORE_DIR) && npm install
	cd $(CORE_DIR) && npm run build

.PHONY: build-gui
build-gui:
	@echo "==> Building GUI"
	cd $(GUI_DIR) && npm install
	cd $(GUI_DIR) && npm run build

# ---------
# Package VSCode Extension
# ---------
.PHONY: package
package:
	@echo "==> Packaging VSCode extension"
	cd $(VSCODE_DIR) && npm install
	cd $(VSCODE_DIR) && npm run prepackage
	cd $(VSCODE_DIR) && npm run package

# ---------
# Install
# ---------
.PHONY: install
install:
	@echo "==> Installing VSCode extension"
	code --install-extension $(VSIX) --force

# ---------
# Clean
# ---------
.PHONY: clean
clean:
	@echo "==> Cleaning workspace"
	rm -rf node_modules
	rm -rf $(CORE_DIR)/node_modules
	rm -rf $(GUI_DIR)/node_modules
	rm -rf $(VSCODE_DIR)/node_modules
	rm -rf $(GUI_DIR)/dist
	rm -rf $(VSCODE_DIR)/out
	rm -rf $(VSCODE_DIR)/build
	rm -rf **/tsconfig.tsbuildinfo
