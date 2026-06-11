import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional

SECRET_KEY        = "change-this-to-a-long-random-secret-key-before-deploying"
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 7

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_token(email: str) -> str:
    payload = {"sub": email, "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None