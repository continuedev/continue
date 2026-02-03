# ============================
# Configuration
# ============================

NODE_OPTIONS := --max-old-space-size=4096
export NODE_OPTIONS

ROOT_DIR := $(CURDIR)
CORE_DIR := $(ROOT_DIR)/core
GUI_DIR := $(ROOT_DIR)/gui
VSCODE_DIR := $(ROOT_DIR)/extensions/vscode
VSIX_DIR := $(VSCODE_DIR)/build
VSIX := $(shell ls $(VSIX_DIR)/continue-*.vsix 2>/dev/null | head -n 1)

# ============================
# Default target
# ============================

.PHONY: all
all: build

# ============================
# Build
# ============================

.PHONY: build
build: deps build-core build-gui build-vscode
	@echo "==> Build complete"

# ----------------------------
# Dependencies
# ----------------------------

.PHONY: deps
deps:
	@echo "==> Installing root dependencies"
	npm install

# ----------------------------
# Core
# ----------------------------

.PHONY: build-core
build-core:
	@echo "==> Building core"
	cd $(CORE_DIR) && npm install
	cd $(CORE_DIR) && npm run build

# ----------------------------
# GUI
# ----------------------------

.PHONY: build-gui
build-gui:
	@echo "==> Building GUI"
	cd $(GUI_DIR) && npm install
	cd $(GUI_DIR) && npm run build

# ----------------------------
# VS Code Extension
# ----------------------------

.PHONY: build-vscode
build-vscode:
	@echo "==> Building VSCode extension"
	cd $(VSCODE_DIR) && npm install
	cd $(VSCODE_DIR) && npm run package

# ============================
# Install
# ============================

.PHONY: install
install:
	@if [ -z "$(VSIX)" ]; then \
		echo "ERROR: VSIX not found. Run 'make build' first."; \
		exit 1; \
	fi
	@echo "==> Installing VSCode extension"
	code --install-extension "$(VSIX)"

# ============================
# Clean
# ============================

.PHONY: clean
clean:
	@echo "==> Removing build artifacts"
	rm -rf node_modules
	rm -rf $(CORE_DIR)/node_modules
	rm -rf $(GUI_DIR)/node_modules
	rm -rf $(VSCODE_DIR)/node_modules
	rm -rf $(VSIX_DIR)
	rm -rf $(VSCODE_DIR)/out
	rm -rf $(GUI_DIR)/dist $(GUI_DIR)/build
