# backend/services/twilio_coverage.py
import json
import os
import time
from pathlib import Path
from typing import Dict, Any, List

from twilio.rest import Client

SNAPSHOT_DIR = Path(__file__).parent.parent / "static" / "telephony"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
SNAPSHOT_FILE = SNAPSHOT_DIR / "twilio_coverage.json"
REG_SEED_FILE = SNAPSHOT_DIR / "twilio_regulations_seed.json"  # opzionale (seed manuale)

def _twilio_client() -> Client:
    from backend.config.settings import settings
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

def _fetch_country_list(client: Client) -> List[Dict[str, Any]]:
    # /AvailablePhoneNumbers.json -> elenco paesi supportati e sotto-risorse (local/mobile/toll_free)
    out = []
    page_size = 1000
    page = 0
    max_pages = 10  # Safety limit
    
    try:
        while page < max_pages:
            resp = client.available_phone_numbers.list(limit=page_size, page_size=page_size, page=page)
            if not resp:
                break
                
            for c in resp:
                # la lib twilio restituisce oggetti con attributi snake_case
                out.append({
                    "country": getattr(c, "country", None),
                    "country_code": getattr(c, "country_code", None),
                    "beta": bool(getattr(c, "beta", False)),
                    "subresource_uris": getattr(c, "subresource_uris", {}) or {},
                    "uri": getattr(c, "uri", None)
                })
            
            page += 1
            # Se abbiamo meno risultati della page_size, abbiamo finito
            if len(resp) < page_size:
                break
                
    except Exception as e:
        # Log error and continue with what we have
        import logging
        logging.warning(f"Twilio pagination error: {e}. Returning {len(out)} countries.")
    
    return out

def _country_types(entry: Dict[str, Any]) -> Dict[str, bool]:
    subs = entry.get("subresource_uris", {}) or {}
    return {
        "local": "local" in subs,
        "mobile": "mobile" in subs,
        "toll_free": "toll_free" in subs,
    }

def build_twilio_snapshot() -> Dict[str, Any]:
    client = _twilio_client()
    countries = _fetch_country_list(client)

    # Log warning se pochi paesi (ma non bloccare)
    if len(countries) < 150:
        import logging
        logging.warning(f"Twilio snapshot countries={len(countries)} (inferiore alla baseline, ma accettabile)")

    # opzionale: carica seed regolatorio statico se presente (arricchisce lo snapshot)
    regs = {}
    if REG_SEED_FILE.exists():
        try:
            regs = json.loads(REG_SEED_FILE.read_text("utf-8"))
        except Exception:
            regs = {}

    out = {
        "provider": "twilio",
        "last_updated": int(time.time()),
        "countries": []
    }
    for c in countries:
        alpha2 = c.get("country_code")
        entry = {
            "alpha2": alpha2,
            "name": c.get("country"),
            "types": _country_types(c),   # True/False per tipo
            "regulatory": regs.get(alpha2) if isinstance(regs, dict) else None  # facoltativo
        }
        out["countries"].append(entry)
    return out

def save_twilio_snapshot(payload: Dict[str, Any]) -> None:
    SNAPSHOT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), "utf-8")

def load_twilio_snapshot() -> Dict[str, Any]:
    if SNAPSHOT_FILE.exists():
        return json.loads(SNAPSHOT_FILE.read_text("utf-8"))
    # fallback minimal se non c'è ancora lo snapshot
    return {"provider": "twilio", "last_updated": None, "countries": []}
