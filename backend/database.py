
from pathlib import Path
import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

# Database location
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATABASE_PATH = BASE_DIR / "drowziness.db"

# Render persistent disks can override the default without changing the project.
configured_path = os.getenv("DROWZINESS_DATABASE_PATH")
DATABASE_PATH = Path(configured_path).expanduser() if configured_path else DEFAULT_DATABASE_PATH
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# SQLite engine
engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 15,
    },
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
)

# Configure every new SQLite connection
@event.listens_for(engine, "connect")
def configure_sqlite(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=15000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

# Enable Write-Ahead Logging
with engine.connect() as connection:
    connection.exec_driver_sql("PRAGMA journal_mode=WAL")

# Database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)

# Base model
Base = declarative_base()

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
