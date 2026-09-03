from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# ============================================================
# USER REGISTRATION
# ============================================================

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str

    # Driver fields
    vehicle_type: Optional[str] = None
    license_number: Optional[str] = None

    # Student fields
    roll_number: Optional[str] = None
    grade: Optional[str] = None
    study_goal: Optional[int] = None


# ============================================================
# LOGIN
# ============================================================

class LoginIn(BaseModel):
    email: EmailStr
    password: str


# ============================================================
# USER UPDATE
# ============================================================

class UserUpdate(BaseModel):
    name: Optional[str] = None
    study_goal: Optional[int] = None
    vehicle_type: Optional[str] = None


# ============================================================
# USER RESPONSE
# ============================================================

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime

    # Driver fields
    vehicle_type: Optional[str] = None
    license_number: Optional[str] = None

    # Student fields
    roll_number: Optional[str] = None
    grade: Optional[str] = None
    study_goal: Optional[int] = None

    class Config:
        from_attributes = True


# ============================================================
# LOGIN TOKEN RESPONSE
# ============================================================

class TokenOut(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str


# ============================================================
# CREATE SESSION
# ============================================================

class SessionCreate(BaseModel):
    duration_seconds: int
    alert_count: int
    focus_score: float

    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


# ============================================================
# SESSION RESPONSE
# ============================================================

class SessionOut(BaseModel):
    id: int
    user_id: int

    duration_seconds: int
    alert_count: int
    focus_score: float

    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# CREATE ALERT
# ============================================================

class AlertCreate(BaseModel):
    alert_type: str = "drowsiness"
    message: Optional[str] = None


# ============================================================
# ALERT RESPONSE
# ============================================================

class AlertOut(BaseModel):
    id: int
    user_id: int
    alert_type: str
    message: Optional[str] = None
    triggered_at: datetime

    class Config:
        from_attributes = True