#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
export PYTHONPATH="$(pwd)"
python3 -m uvicorn backend.core.main:app --host 0.0.0.0 --port 8000 --reload 