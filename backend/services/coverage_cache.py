# backend/services/coverage_cache.py
import json
import time
import pathlib
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Directory per gli snapshot
SNAP_DIR = pathlib.Path(__file__).resolve().parents[2] / "static" / "telephony"
SNAP_DIR.mkdir(parents=True, exist_ok=True)

# Cache in memoria: {provider: {"ts": float, "data": dict, "etag": str}}
_mem: Dict[str, Dict[str, Any]] = {}

def _path(provider: str) -> pathlib.Path:
    """Restituisce il path per il file di coverage del provider"""
    return SNAP_DIR / f"{provider.lower()}_coverage.json"

def load_disk(provider: str) -> Optional[dict]:
    """Carica coverage da disco"""
    try:
        p = _path(provider)
        if not p.exists():
            return None
        data = json.loads(p.read_text(encoding="utf-8"))
        logger.info(f"Loaded {provider} coverage from disk: {len(data.get('countries', []))} countries")
        return data
    except Exception as e:
        logger.error(f"Failed to load {provider} coverage from disk: {e}")
        return None

def save_disk(provider: str, data: dict) -> None:
    """Salva coverage su disco"""
    try:
        p = _path(provider)
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(f"Saved {provider} coverage to disk: {len(data.get('countries', []))} countries")
    except Exception as e:
        logger.error(f"Failed to save {provider} coverage to disk: {e}")

def set_mem(provider: str, data: dict) -> None:
    """Imposta coverage in memoria con timestamp e ETag"""
    etag = str(hash(json.dumps(data, sort_keys=True)))
    _mem[provider] = {
        "ts": time.time(),
        "data": data,
        "etag": etag
    }
    logger.info(f"Set {provider} coverage in memory cache, ETag: {etag[:8]}...")

def get(provider: str, max_age_s: int = 86400) -> Optional[dict]:
    """
    Restituisce coverage dal provider con fallback memoria -> disco -> None
    
    Args:
        provider: Nome del provider (twilio, telnyx)
        max_age_s: Età massima cache in secondi (default: 24h)
    
    Returns:
        Coverage data o None se non disponibile
    """
    # 1. Prova cache in memoria
    item = _mem.get(provider)
    if item and (time.time() - item["ts"]) < max_age_s:
        logger.debug(f"Returning {provider} coverage from memory cache")
        return item["data"]
    
    # 2. Prova caricamento da disco
    disk_data = load_disk(provider)
    if disk_data:
        # Aggiorna cache in memoria
        set_mem(provider, disk_data)
        return disk_data
    
    # 3. Fallback: nessun dato disponibile
    logger.warning(f"No coverage data available for {provider}")
    return None

def headers(provider: str) -> Dict[str, str]:
    """Restituisce header HTTP per caching e ETag"""
    item = _mem.get(provider)
    etag = item.get("etag", "") if item else ""
    
    return {
        "Cache-Control": "public, max-age=86400, immutable",
        "ETag": etag,
        "Last-Modified": time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    }

def invalidate(provider: str) -> None:
    """Invalida cache per un provider specifico"""
    if provider in _mem:
        del _mem[provider]
        logger.info(f"Invalidated memory cache for {provider}")

def clear_all() -> None:
    """Pulisce tutta la cache in memoria"""
    _mem.clear()
    logger.info("Cleared all memory cache")

def get_stats() -> Dict[str, Any]:
    """Restituisce statistiche della cache"""
    stats = {}
    for provider, item in _mem.items():
        age = time.time() - item["ts"]
        stats[provider] = {
            "age_seconds": age,
            "age_hours": age / 3600,
            "etag": item["etag"][:8] + "...",
            "countries_count": len(item["data"].get("countries", []))
        }
    return stats
