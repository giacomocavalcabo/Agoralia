web: PYTHONPATH=/app/backend python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
worker: PYTHONPATH=/app/backend python -m dramatiq backend.worker

