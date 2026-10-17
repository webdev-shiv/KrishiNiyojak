"""Tests for application health and status verification."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check() -> None:
    """Test that GET /health returns HTTP 200 and {'status': 'ok'}."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_docs_and_openapi_registered() -> None:
    """Verify that Swagger UI and OpenAPI schema are accessible without requiring a database."""
    docs_response = client.get("/docs")
    assert docs_response.status_code == 200

    openapi_response = client.get("/openapi.json")
    assert openapi_response.status_code == 200
    schema = openapi_response.json()
    assert schema["info"]["title"] == "Machine-Day Composer"
    assert "/health" in schema["paths"]
    assert "/api/v1/auth/register" in schema["paths"]
    assert "/api/v1/auth/login" in schema["paths"]
    assert "/api/v1/chcs" in schema["paths"]
    assert "/api/v1/machines" in schema["paths"]
    assert "/api/v1/operators" in schema["paths"]
    assert "/api/v1/attachments" in schema["paths"]


def test_unreachable_database_returns_503() -> None:
    """Verify that a database operation returns clear HTTP 503 if the database is offline."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "DummyPassword123!"},
    )
    assert response.status_code == 503
    assert "Database connection failed" in response.json()["detail"]
