# backend/services/crypto.py
import base64
import os
from cryptography.fernet import Fernet

FERNET_KEY = base64.urlsafe_b64encode(
    (os.getenv("APP_KMS_KEY", "") or "dev_kms_key_dev_kms_key_32bytes!").encode()[:32]
)
_f = Fernet(FERNET_KEY)

def enc(s: str) -> str: 
    return _f.encrypt(s.encode()).decode()

def dec(s: str) -> str: 
    return _f.decrypt(s.encode()).decode()
