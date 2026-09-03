from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime

from backend import models, schemas, database, auth


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

models.Base.metadata.create_all(bind=database.engine)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Drowziness API",
    description="Backend for AI Drowsiness Detector",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

# Keep this open during deployment/testing.
# After your Vercel frontend is deployed, we can replace "*"
# with your exact Vercel URL.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================
# AUTHENTICATION
# ============================================================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db)
):
    """
    Get the currently logged-in user from the JWT token.
    """

    email = auth.verify_token(token)

    if not email:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user = (
        db.query(models.User)
        .filter(models.User.email == email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "message": "Drowziness API is running"
    }


# ============================================================
# AUTH ROUTES
# ============================================================

@app.post(
    "/register",
    response_model=schemas.UserOut,
    tags=["Auth"]
)
def register(
    data: schemas.UserCreate,
    db: Session = Depends(database.get_db)
):
    """
    Register a new user.
    """

    # Check whether email already exists
    existing_user = (
        db.query(models.User)
        .filter(models.User.email == data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Create new user
    user = models.User(
        name=data.name,
        email=data.email,
        password=auth.hash_password(data.password),
        role=data.role,
        vehicle_type=data.vehicle_type,
        license_number=data.license_number,
        roll_number=data.roll_number,
        grade=data.grade,
        study_goal=data.study_goal
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@app.post(
    "/login",
    response_model=schemas.TokenOut,
    tags=["Auth"]
)
def login(
    data: schemas.LoginIn,
    db: Session = Depends(database.get_db)
):
    """
    Login an existing user and return JWT token.
    """

    user = (
        db.query(models.User)
        .filter(models.User.email == data.email)
        .first()
    )

    # Check user and password
    if not user or not auth.verify_password(
        data.password,
        user.password
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    # Create JWT token
    access_token = auth.create_token(user.email)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name
    }


# ============================================================
# USER ROUTES
# ============================================================

@app.get(
    "/me",
    response_model=schemas.UserOut,
    tags=["User"]
)
def get_me(
    current_user: models.User = Depends(get_current_user)
):
    """
    Get currently logged-in user's information.
    """

    return current_user


@app.put(
    "/me",
    response_model=schemas.UserOut,
    tags=["User"]
)
def update_me(
    updates: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Update currently logged-in user's profile.
    """

    if updates.name is not None:
        current_user.name = updates.name

    if updates.study_goal is not None:
        current_user.study_goal = updates.study_goal

    if updates.vehicle_type is not None:
        current_user.vehicle_type = updates.vehicle_type

    db.commit()
    db.refresh(current_user)

    return current_user


# ============================================================
# SESSION ROUTES
# ============================================================

@app.post(
    "/sessions",
    response_model=schemas.SessionOut,
    tags=["Sessions"]
)
def create_session(
    data: schemas.SessionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Save a completed drowsiness monitoring session.
    """

    session = models.Session(
        user_id=current_user.id,
        duration_seconds=data.duration_seconds,
        alert_count=data.alert_count,
        focus_score=data.focus_score,
        started_at=data.started_at,
        ended_at=data.ended_at
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session


@app.get(
    "/sessions",
    response_model=list[schemas.SessionOut],
    tags=["Sessions"]
)
def get_sessions(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all sessions belonging to the logged-in user.
    """

    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == current_user.id)
        .order_by(models.Session.started_at.desc())
        .all()
    )

    return sessions


@app.get(
    "/sessions/stats",
    tags=["Sessions"]
)
def get_stats(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get statistics for the logged-in user's sessions.
    """

    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == current_user.id)
        .all()
    )

    # No sessions yet
    if not sessions:
        return {
            "total_sessions": 0,
            "total_alerts": 0,
            "average_focus": 0,
            "total_hours": 0
        }

    total_sessions = len(sessions)

    total_alerts = sum(
        session.alert_count or 0
        for session in sessions
    )

    average_focus = round(
        sum(session.focus_score or 0 for session in sessions)
        / total_sessions,
        1
    )

    total_hours = round(
        sum(session.duration_seconds or 0 for session in sessions)
        / 3600,
        1
    )

    return {
        "total_sessions": total_sessions,
        "total_alerts": total_alerts,
        "average_focus": average_focus,
        "total_hours": total_hours
    }


# ============================================================
# ALERT ROUTES
# ============================================================

@app.post(
    "/alerts",
    response_model=schemas.AlertOut,
    tags=["Alerts"]
)
def log_alert(
    data: schemas.AlertCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Save a drowsiness alert for the logged-in user.
    """

    alert = models.Alert(
        user_id=current_user.id,
        alert_type=data.alert_type,
        message=data.message,
        triggered_at=datetime.utcnow()
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert


@app.get(
    "/alerts",
    response_model=list[schemas.AlertOut],
    tags=["Alerts"]
)
def get_alerts(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get the latest 50 alerts for the logged-in user.
    """

    alerts = (
        db.query(models.Alert)
        .filter(models.Alert.user_id == current_user.id)
        .order_by(models.Alert.triggered_at.desc())
        .limit(50)
        .all()
    )

    return alerts