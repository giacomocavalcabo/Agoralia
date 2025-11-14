#!/bin/bash
set -e

# Use venv Python if it exists, otherwise fallback to system python
if [ -f /app/.venv/bin/python ]; then
    PYTHON=/app/.venv/bin/python
else
    echo "Warning: venv not found, using system python"
    PYTHON=python
fi

# Start uvicorn
exec $PYTHON -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}

