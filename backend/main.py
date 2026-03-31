from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime

import models
import schemas
import database
import auth

# ── Create all DB tables ─────────────────────────────
models.Base.metadata.create_all(bind=database.engine)

# ── App ──────────────────────────────────────────────
app = FastAPI(
    title="Drowziness API",
    description="Backend for the AI Drowsiness Detector app",
    version="1.0.0"
)

# ── CORS (allow your frontend to talk to this API) ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # change to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


# ── Helper: get current logged-in user from token ───
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db)
):
    email = auth.verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ════════════════════════════════════════════════════
#  AUTH ROUTES
# ════════════════════════════════════════════════════

@app.post("/register", response_model=schemas.UserOut, tags=["Auth"])
def register(user_data: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """Register a new user (driver or student)."""

    # Check if email already exists
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash the password
    hashed = auth.hash_password(user_data.password)

    # Create user
    new_user = models.User(
        name=user_data.name,
        email=user_data.email,
        password=hashed,
        role=user_data.role,
        # Driver fields
        vehicle_type=user_data.vehicle_type,
        license_number=user_data.license_number,
        # Student fields
        roll_number=user_data.roll_number,
        grade=user_data.grade,
        study_goal=user_data.study_goal,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.TokenOut, tags=["Auth"])
def login(credentials: schemas.LoginIn, db: Session = Depends(database.get_db)):
    """Login and receive a JWT token."""

    user = db.query(models.User).filter(models.User.email == credentials.email).first()

    if not user or not auth.verify_password(credentials.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = auth.create_token(user.email)

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name
    }


# ════════════════════════════════════════════════════
#  USER ROUTES
# ════════════════════════════════════════════════════

@app.get("/me", response_model=schemas.UserOut, tags=["User"])
def get_me(current_user: models.User = Depends(get_current_user)):
    """Get the currently logged-in user's profile."""
    return current_user


@app.put("/me", response_model=schemas.UserOut, tags=["User"])
def update_me(
    updates: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update the current user's profile."""
    if updates.name:
        current_user.name = updates.name
    if updates.study_goal is not None:
        current_user.study_goal = updates.study_goal
    if updates.vehicle_type:
        current_user.vehicle_type = updates.vehicle_type

    db.commit()
    db.refresh(current_user)
    return current_user


# ════════════════════════════════════════════════════
#  SESSION ROUTES
# ════════════════════════════════════════════════════

@app.post("/sessions", response_model=schemas.SessionOut, tags=["Sessions"])
def create_session(
    session_data: schemas.SessionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Save a completed detection session."""
    new_session = models.Session(
        user_id=current_user.id,
        duration_seconds=session_data.duration_seconds,
        alert_count=session_data.alert_count,
        focus_score=session_data.focus_score,
        started_at=session_data.started_at,
        ended_at=session_data.ended_at,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@app.get("/sessions", response_model=list[schemas.SessionOut], tags=["Sessions"])
def get_sessions(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all sessions for the current user."""
    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == current_user.id)
        .order_by(models.Session.started_at.desc())
        .all()
    )
    return sessions


@app.get("/sessions/stats", tags=["Sessions"])
def get_stats(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get summary stats for the current user."""
    sessions = db.query(models.Session).filter(
        models.Session.user_id == current_user.id
    ).all()

    if not sessions:
        return {"total_sessions": 0, "total_alerts": 0, "average_focus": 0, "total_hours": 0}

    total_alerts = sum(s.alert_count for s in sessions)
    avg_focus    = round(sum(s.focus_score for s in sessions) / len(sessions), 1)
    total_hours  = round(sum(s.duration_seconds for s in sessions) / 3600, 1)

    return {
        "total_sessions": len(sessions),
        "total_alerts":   total_alerts,
        "average_focus":  avg_focus,
        "total_hours":    total_hours,
    }


# ════════════════════════════════════════════════════
#  ALERT ROUTES
# ════════════════════════════════════════════════════

@app.post("/alerts", response_model=schemas.AlertOut, tags=["Alerts"])
def log_alert(
    alert_data: schemas.AlertCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Log a single drowsiness alert event."""
    alert = models.Alert(
        user_id=current_user.id,
        alert_type=alert_data.alert_type,
        message=alert_data.message,
        triggered_at=datetime.utcnow(),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@app.get("/alerts", response_model=list[schemas.AlertOut], tags=["Alerts"])
def get_alerts(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all alerts for the current user."""
    alerts = (
        db.query(models.Alert)
        .filter(models.Alert.user_id == current_user.id)
        .order_by(models.Alert.triggered_at.desc())
        .limit(50)
        .all()
    )
    return alerts


# ── Health check ─────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Drowziness API is running"}