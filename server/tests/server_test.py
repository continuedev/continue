from continuedev.core.main import SessionState
from continuedev.server.main import app
from continuedev.server.sessions import PersistedSessionInfo
from fastapi.testclient import TestClient

client = TestClient(app)


def test_read_main():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_persisted_sessions():
    session = PersistedSessionInfo(
        session_state=SessionState.from_empty(),
        title="test",
        workspace_directory="test",
        session_id="test",
    )

    response = client.post("/sessions/save", json=session.dict())
    assert response.status_code == 200

    response = client.get("/sessions/list")
    assert response.status_code == 200
    data = response.json()
    assert (
        len(data) >= 1
        and data[-1]["session_id"] == "test"
        and data[-1]["title"] == "test"
        and data[-1]["workspace_directory"] == "test"
    )

    response = client.get("/sessions/test")
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "test"
    assert data["title"] == "test"
    assert data["workspace_directory"] == "test"
    assert data["session_state"]["history"] == []
    assert data["session_state"]["context_items"] == []

    response = client.post("/sessions/delete", json={"session_id": "test"})
    assert response.status_code == 200

    response = client.get("/sessions/list")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0 or data[-1]["session_id"] != "test"
