from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ── Database URL ─────────────────────────────────────
# Using SQLite for now — easy, no setup needed.
# To switch to PostgreSQL later, just change this line to:
# DATABASE_URL = "postgresql://user:password@localhost/drowziness"
DATABASE_URL = "sqlite:///./drowziness.db"

# ── Engine ───────────────────────────────────────────
# connect_args is needed only for SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# ── Session factory ──────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── Base class for all models ────────────────────────
Base = declarative_base()


# ── Dependency: gives each request its own DB session ─
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()