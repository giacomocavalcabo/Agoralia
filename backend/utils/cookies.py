from urllib.parse import urlparse
from fastapi import Response

def _cookie_domain(frontend_url: str) -> str | None:
    """
    Estrae il dominio per i cookie cross-subdomain.
    
    Esempi:
    - app.agoralia.app -> .agoralia.app (cross-subdomain)
    - api.agoralia.app -> .agoralia.app (cross-subdomain)
    - localhost:3000 -> None (dev locale)
    - 127.0.0.1:3000 -> None (dev locale)
    """
    host = urlparse(frontend_url).hostname or ""
    parts = host.split(".")
    
    # Se ha almeno 2 parti e non è un dominio locale
    if len(parts) >= 2 and not host.endswith(".local") and not host.startswith("127.0.0.1") and not host.startswith("localhost"):
        return "." + ".".join(parts[-2:])
    
    return None  # localhost o dev locale

def set_session_cookie(response: Response, token: str, frontend_url: str, max_age: int = 60*60*24*30):
    """
    Imposta il cookie di sessione con configurazione cross-subdomain.
    
    Args:
        response: FastAPI Response object
        token: JWT token da salvare
        frontend_url: URL del frontend (es. https://app.agoralia.app)
        max_age: Durata del cookie in secondi (default: 30 giorni)
    """
    domain = _cookie_domain(frontend_url)
    
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,        # Non accessibile da JavaScript
        secure=True,          # Solo su HTTPS
        samesite="none",      # Necessario per cross-site (api.agoralia.app <-> app.agoralia.app)
        domain=domain,        # .agoralia.app in prod; None in dev
        path="/",
        max_age=max_age,
    )
