web: PYTHONPATH=/app/backend /app/.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
worker: PYTHONPATH=/app/backend /app/.venv/bin/python -m dramatiq backend.worker

