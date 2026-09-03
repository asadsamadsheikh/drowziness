from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base


# ============================================================
# DATABASE LOCATION
# ============================================================

# Get the folder where this database.py file is located
BASE_DIR = Path(__file__).resolve().parent

# SQLite database file
DATABASE_URL = f"sqlite:///{BASE_DIR / 'drowziness.db'}"


# ============================================================
# DATABASE ENGINE
# ============================================================

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False
    }
)


# ============================================================
# DATABASE SESSION
# ============================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# ============================================================
# BASE CLASS
# ============================================================

Base = declarative_base()


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db():
    """
    Create a database session for each request.
    The session is automatically closed after the request.
    """

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()