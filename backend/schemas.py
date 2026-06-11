from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    name:           str
    email:          EmailStr
    password:       str
    role:           str
    vehicle_type:   Optional[str] = None
    license_number: Optional[str] = None
    roll_number:    Optional[str] = None
    grade:          Optional[str] = None
    study_goal:     Optional[int] = None

class LoginIn(BaseModel):
    email:    EmailStr
    password: str

class UserUpdate(BaseModel):
    name:         Optional[str] = None
    study_goal:   Optional[int] = None
    vehicle_type: Optional[str] = None

class UserOut(BaseModel):
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

class TokenOut(BaseModel):
    access_token: str
    token_type:   str
    role:         str
    name:         str

class SessionCreate(BaseModel):
    duration_seconds: int
    alert_count:      int
    focus_score:      float
    started_at:       Optional[datetime] = None
    ended_at:         Optional[datetime] = None

class SessionOut(BaseModel):
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

class AlertCreate(BaseModel):
    alert_type: str = "drowsiness"
    message:    Optional[str] = None

class AlertOut(BaseModel):
    id:           int
    user_id:      int
    alert_type:   str
    message:      Optional[str]
    triggered_at: datetime
    class Config:
        from_attributes = True