from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    """Stores all registered users — both drivers and students."""
    __tablename__ = "users"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String,  nullable=False)
    email          = Column(String,  unique=True, index=True, nullable=False)
    password       = Column(String,  nullable=False)        # hashed
    role           = Column(String,  nullable=False)        # "driver" or "student"
    created_at     = Column(DateTime, default=datetime.utcnow)

    # Driver-only fields
    vehicle_type   = Column(String,  nullable=True)         # car, truck, bus, bike
    license_number = Column(String,  nullable=True)

    # Student-only fields
    roll_number    = Column(String,  nullable=True)
    grade          = Column(String,  nullable=True)
    study_goal     = Column(Integer, nullable=True)         # hours per day

    # Relationships
    sessions = relationship("Session", back_populates="user")
    alerts   = relationship("Alert",   back_populates="user")


class Session(Base):
    """Stores one detection session (from Start to Stop)."""
    __tablename__ = "sessions"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    duration_seconds = Column(Integer, default=0)
    alert_count      = Column(Integer, default=0)
    focus_score      = Column(Float,   default=100.0)
    started_at       = Column(DateTime, nullable=True)
    ended_at         = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")


class Alert(Base):
    """Stores individual drowsiness alert events."""
    __tablename__ = "alerts"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    alert_type   = Column(String,  default="drowsiness")   # drowsiness, head_nod, etc.
    message      = Column(String,  nullable=True)
    triggered_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="alerts")