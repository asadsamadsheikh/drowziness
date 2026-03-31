from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


# ════════════════════════════════════════════════════
#  USER SCHEMAS
# ════════════════════════════════════════════════════

class UserCreate(BaseModel):
    """Data needed to register a new user."""
    name:           str
    email:          EmailStr
    password:       str
    role:           str             # "driver" or "student"

    # Driver fields (optional)
    vehicle_type:   Optional[str]  = None
    license_number: Optional[str]  = None

    # Student fields (optional)
    roll_number:    Optional[str]  = None
    grade:          Optional[str]  = None
    study_goal:     Optional[int]  = None


class LoginIn(BaseModel):
    """Data needed to log in."""
    email:    EmailStr
    password: str


class UserUpdate(BaseModel):
    """Fields the user can update in their profile."""
    name:         Optional[str] = None
    study_goal:   Optional[int] = None
    vehicle_type: Optional[str] = None


class UserOut(BaseModel):
    """What we send back when returning user data — never includes password."""
    id:             int
    name:           str
    email:          str
    role:           str
    created_at:     datetime
    vehicle_type:   Optional[str] = None
    license_number: Optional[str] = None
    roll_number:    Optional[str] = None
    grade:          Optional[str] = None
    study_goal:     Optional[int] = None

    class Config:
        from_attributes = True


# ════════════════════════════════════════════════════
#  AUTH SCHEMAS
# ════════════════════════════════════════════════════

class TokenOut(BaseModel):
    """JWT token returned after login."""
    access_token: str
    token_type:   str
    role:         str
    name:         str


# ════════════════════════════════════════════════════
#  SESSION SCHEMAS
# ════════════════════════════════════════════════════

class SessionCreate(BaseModel):
    """Data sent when saving a completed session."""
    duration_seconds: int
    alert_count:      int
    focus_score:      float
    started_at:       Optional[datetime] = None
    ended_at:         Optional[datetime] = None


class SessionOut(BaseModel):
    """Session data returned from the API."""
    id:               int
    user_id:          int
    duration_seconds: int
    alert_count:      int
    focus_score:      float
    started_at:       Optional[datetime]
    ended_at:         Optional[datetime]
    created_at:       datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════════════════
#  ALERT SCHEMAS
# ════════════════════════════════════════════════════

class AlertCreate(BaseModel):
    """Data sent when logging a single alert."""
    alert_type: str = "drowsiness"
    message:    Optional[str] = None


class AlertOut(BaseModel):
    """Alert data returned from the API."""
    id:           int
    user_id:      int
    alert_type:   str
    message:      Optional[str]
    triggered_at: datetime

    class Config:
        from_attributes = True