from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey
)

from sqlalchemy.orm import relationship

from backend.database import Base


# ============================================================
# USER MODEL
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    password = Column(
        String,
        nullable=False
    )

    role = Column(
        String,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # --------------------------------------------------------
    # DRIVER FIELDS
    # --------------------------------------------------------

    vehicle_type = Column(
        String,
        nullable=True
    )

    license_number = Column(
        String,
        nullable=True
    )

    # --------------------------------------------------------
    # STUDENT FIELDS
    # --------------------------------------------------------

    roll_number = Column(
        String,
        nullable=True
    )

    grade = Column(
        String,
        nullable=True
    )

    study_goal = Column(
        Integer,
        nullable=True
    )

    # --------------------------------------------------------
    # RELATIONSHIPS
    # --------------------------------------------------------

    sessions = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    alerts = relationship(
        "Alert",
        back_populates="user",
        cascade="all, delete-orphan"
    )


# ============================================================
# SESSION MODEL
# ============================================================

class Session(Base):
    __tablename__ = "sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    duration_seconds = Column(
        Integer,
        default=0
    )

    alert_count = Column(
        Integer,
        default=0
    )

    focus_score = Column(
        Float,
        default=100.0
    )

    started_at = Column(
        DateTime,
        nullable=True
    )

    ended_at = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # --------------------------------------------------------
    # RELATIONSHIP
    # --------------------------------------------------------

    user = relationship(
        "User",
        back_populates="sessions"
    )


# ============================================================
# ALERT MODEL
# ============================================================

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    alert_type = Column(
        String,
        default="drowsiness"
    )

    message = Column(
        String,
        nullable=True
    )

    triggered_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # --------------------------------------------------------
    # RELATIONSHIP
    # --------------------------------------------------------

    user = relationship(
        "User",
        back_populates="alerts"
    )