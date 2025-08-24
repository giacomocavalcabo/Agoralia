# backend/logger.py
import logging
import sys

logger = logging.getLogger("agoralia")
logger.setLevel(logging.INFO)

_handler = logging.StreamHandler(sys.stdout)
_formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
_handler.setFormatter(_formatter)

# evita handler duplicati in reload
if not logger.handlers:
    logger.addHandler(_handler)

# non propagare a uvicorn per evitare doppie stampe
logger.propagate = False
