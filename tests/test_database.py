"""Database connectivity and operational readiness tests."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import engine, get_db


def test_database_connectivity() -> None:
    """Verify that the application can connect to the configured database.

    Executes 'SELECT 1' directly on the configured engine.
    Must fail clearly if the database service is unavailable. Never silently skipped.
    """
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1")).scalar()
        assert result == 1


def test_database_session_dependency() -> None:
    """Verify that get_db yields a valid SQLAlchemy Session and cleanly closes."""
    db_gen = get_db()
    session = next(db_gen)
    assert isinstance(session, Session)
    try:
        next(db_gen)
    except StopIteration:
        pass
