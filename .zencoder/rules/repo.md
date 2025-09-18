# Repository Overview

- **Root**: c:\Users\123\Music\PTH_instant_strengthening\venv\Scripts\continue
- **Primary languages**: TypeScript/JavaScript (multi-package), plus docs and VS Code extension sources
- **Key packages**:
  - core/, gui/, extensions/vscode, extensions/cli, binary/, packages/*
- **Build/Dev**:
  - VS Code tasks configured in .vscode/tasks.json
  - NPM scripts for TypeScript watch, formatting

## Run & Build
- VS Code tasks: use Command Palette → "Tasks: Run Task"
- Scripts (root package.json):
  - `npm run tsc:watch` – watch all TS projects
  - `npm run format` – Prettier write
  - `npm run format:check` – Prettier check
  - `npm run py:format` – Black + isort
  - `npm run py:lint` – Ruff (auto-fix) or fallback to flake8
  - `npm run py:test` – Pytest quick mode
  - `npm run py:all` – format + lint + test

## Continue Configuration
- `.continue/config.json` with models and embeddings
  - Chat: DeepSeek Coder 33B (Ollama)
  - Autocomplete: DeepSeek Coder 6.7B (Ollama)
  - Embeddings: mxbai-embed-large (Ollama)

## Indexing & Ignore
- `.continueignore` tuned to skip heavy/unnecessary folders: node_modules/, dist/, build/, .cache/, coverage, logs, maps, etc.

## Notes
- Use Ollama to pull models before first use:
  - `ollama pull deepseek-coder:33b`
  - `ollama pull deepseek-coder:6.7b`
  - `ollama pull mxbai-embed-large`
- If Python tools missing:
  - `pip install black isort ruff flake8 pytest`