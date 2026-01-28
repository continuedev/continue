# ============================
# Configuration
# ============================

NODE_OPTIONS := --max-old-space-size=4096
export NODE_OPTIONS

ROOT_DIR := $(CURDIR)
VSCODE_DIR := $(ROOT_DIR)/extensions/vscode
VSIX_DIR := $(VSCODE_DIR)/build

# ============================
# Default target
# ============================

.PHONY: all
all: build

# ============================
# Build targets
# ============================

.PHONY: build
build: build-deps build-vscode
	@echo "==> Build complete"

.PHONY: build-deps
build-deps:
	@echo "==> Installing root dependencies"
	npm install

	@echo "==> Building core"
	npx tsc -p core/tsconfig.json --pretty false

	@echo "==> Building GUI"
	npx tsc -p gui/tsconfig.json --pretty false

.PHONY: build-vscode
build-vscode:
	@echo "==> Installing VSCode extension dependencies"
	cd $(VSCODE_DIR) && npm install

	@echo "==> Packaging VSCode extension"
	cd $(VSCODE_DIR) && npm run package

# ============================
# Install target
# ============================

.PHONY: install
install:
	@VSIX=$$(ls $(VSIX_DIR)/continue-*.vsix 2>/dev/null | head -n 1); \
	if [ -z "$$VSIX" ]; then \
		echo "ERROR: VSIX not found. Run 'make build' first."; \
		exit 1; \
	fi; \
	echo "==> Installing VSCode extension"; \
	code --install-extension "$$VSIX" --force

# ============================
# Clean targets
# ============================

.PHONY: clean
clean: clean-build clean-node
	@echo "==> Clean complete"

.PHONY: clean-build
clean-build:
	@echo "==> Removing build artifacts"
	rm -rf $(VSIX_DIR)
	rm -rf $(VSCODE_DIR)/out
	rm -rf core/dist
	rm -rf gui/dist

.PHONY: clean-node
clean-node:
	@echo "==> Removing node_modules"
	rm -rf node_modules
	rm -rf core/node_modules
	rm -rf gui/node_modules
	rm -rf $(VSCODE_DIR)/node_modules
