import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
 
# ── Config ───────────────────────────────────────────
# SECRET_KEY: change this to a long random string in production!
# You can generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY        = "change-this-to-a-long-random-secret-key"
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 7       # token stays valid for 7 days
 
 
# ── Password hashing ─────────────────────────────────
 
def hash_password(plain_password: str) -> str:
    """Turn a plain password into a secure hash."""
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()
 
 
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a plain password matches the stored hash."""
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
 
 
# ── JWT tokens ───────────────────────────────────────
 
def create_token(email: str) -> str:
    """Create a JWT token that contains the user's email."""
    expire  = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
 
 
def verify_token(token: str) -> Optional[str]:
    """
    Decode a JWT token and return the email inside it.
    Returns None if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        return email
    except JWTError:
        return None