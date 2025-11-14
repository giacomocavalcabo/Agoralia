"""Utility functions for Agoralia backend"""
from .redis_client import get_redis
from .r2_client import get_r2_client, r2_put_bytes, r2_presign_get
from .auth import extract_tenant_id, _decode_token, _encode_token, _hash_password, _verify_password
from .tenant import tenant_session, _set_tenant_session, _is_postgres
from .helpers import country_iso_from_e164, _resolve_lang, _resolve_agent
from .websocket import manager, ConnectionManager
from .retell import get_retell_headers, get_retell_base_url, retell_get_json

__all__ = [
    "get_redis",
    "get_r2_client",
    "r2_put_bytes",
    "r2_presign_get",
    "extract_tenant_id",
    "_decode_token",
    "_encode_token",
    "_hash_password",
    "_verify_password",
    "tenant_session",
    "_set_tenant_session",
    "_is_postgres",
    "country_iso_from_e164",
    "_resolve_lang",
    "_resolve_agent",
    "manager",
    "ConnectionManager",
    "get_retell_headers",
    "get_retell_base_url",
    "retell_get_json",
]

