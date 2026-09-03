import os
import bcrypt

from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional


# ============================================================
# JWT CONFIGURATION
# ============================================================

# SECRET_KEY is taken from Render Environment Variables
SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. "
        "Please add SECRET_KEY in Render Environment Variables."
    )

ALGORITHM = "HS256"

TOKEN_EXPIRE_DAYS = 7


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(plain: str) -> str:
    """
    Hash a user's password using bcrypt.
    """

    hashed = bcrypt.hashpw(
        plain.encode("utf-8"),
        bcrypt.gensalt()
    )

    return hashed.decode("utf-8")


# ============================================================
# PASSWORD VERIFICATION
# ============================================================

def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a plain password against the stored bcrypt hash.
    """

    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


# ============================================================
# CREATE JWT TOKEN
# ============================================================

def create_token(email: str) -> str:
    """
    Create a JWT token for the user's email.
    """

    expire_time = datetime.utcnow() + timedelta(
        days=TOKEN_EXPIRE_DAYS
    )

    payload = {
        "sub": email,
        "exp": expire_time
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token


# ============================================================
# VERIFY JWT TOKEN
# ============================================================

def verify_token(token: str) -> Optional[str]:
    """
    Verify JWT token and return the user's email.
    """

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        email = payload.get("sub")

        if not email:
            return None

        return email

    except JWTError:
        return None