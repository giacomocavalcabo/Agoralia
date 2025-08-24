"""
Security utilities for Agoralia API
Password hashing and verification
"""
from passlib.context import CryptContext

# Configura il contesto per l'hashing delle password
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una password in chiaro contro il suo hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Genera un hash sicuro per una password"""
    return pwd_context.hash(password)
