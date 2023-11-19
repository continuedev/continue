import asyncio
import threading
from contextlib import asynccontextmanager
from multiprocessing import Process
from typing import Any
from uuid import uuid4

import pytest
import socketio
from continuedev.core.main import StepDescription
from continuedev.server.main import run_server
from continuedev.server.meilisearch_server import kill_proc

PORT = 8001

pytest.skip("Local only", allow_module_level=True)

# @pytest.fixture(scope="module", autouse=True)
# def server():
#     loop = asyncio.new_event_loop()

#     async def server_start_inner():
#         run_server(PORT)

#     task: Any = None

#     def thread_start():
#         nonlocal task

#         asyncio.set_event_loop(loop)
#         task = loop.create_task(server_start_inner())
#         loop.run_until_complete(asyncio.sleep(5))

#     thread = threading.Thread(target=thread_start)
#     thread.start()
#     yield
#     if task:
#         task.cancel()

#     kill_proc(PORT)

#     loop.close()


# @pytest.fixture(scope="module", autouse=True)
# def server():
#     proc = Process(target=run_server, args=(PORT,), daemon=True)
#     proc.start()
#     yield
#     proc.kill()


async def get_client():
    await asyncio.sleep(2)
    sio = socketio.AsyncClient()
    await sio.connect(
        f"http://localhost:{PORT}/gui/socket.io?window_id=test",
        transports=["websocket", "polling"],
    )
    return sio


async def request(
    sio: socketio.AsyncClient, message_type: str, data: Any, use_ack: bool = False
) -> Any:
    future = asyncio.Future()
    await sio.emit(
        "message",
        {
            "message_type": message_type,
            "data": data,
            "message_id": str(uuid4()),
        },
        callback=future.set_result if use_ack else None,
    )

    if not use_ack:
        sio.on("message", future.set_result)

    await asyncio.wait_for(future, timeout=5)
    return future.result()


async def send(sio: socketio.AsyncClient, message_type: str, data: Any) -> Any:
    await sio.emit(
        "message",
        {
            "message_type": message_type,
            "data": data,
            "message_id": str(uuid4()),
        },
    )


@asynccontextmanager
async def sio_client():
    sio = socketio.AsyncClient()
    await sio.connect(
        f"http://localhost:{PORT}?window_id=test",
        socketio_path="/gui/socket.io",
        transports=["websocket", "polling"],
    )
    yield sio
    await sio.disconnect()


@pytest.mark.asyncio
async def test_empty_input():
    async with sio_client() as sio:
        resp = await request(
            sio,
            "run_from_state",
            {"state": {"context_items": [], "history": []}},
        )

        assert resp["data"]["stop"] is True


# @pytest.mark.asyncio
# async def test_get_ctx_item():
# async with sio_client() as sio:
#     resp = await request(
#         sio,
#         "get_context_item",
#         {"id": "test", "query": "test"},
#     )

#     assert resp is None


def user_input_step(content):
    return StepDescription(
        name="User Input",
        description=content,
        hide=False,
        step_type="UserInputStep",
        params={"user_input": content},
        depth=0,
    ).dict()


def assistant_step(content):
    return StepDescription(
        name="Assistant",
        description=content,
        hide=False,
        step_type="AssistantStep",
        params={},
        depth=0,
    ).dict()


@pytest.mark.asyncio
async def test_get_session_title():
    async with sio_client() as sio:
        resp = await request(
            sio,
            "get_session_title",
            {
                "history": [
                    user_input_step("Please explain bubble sort in python"),
                    assistant_step(
                        "Sure! Bubble sort is an algorithm that sorts a list of items in O(n^2) time."
                    ),
                ]
            },
            use_ack=True,
        )

        assert isinstance(resp, str)
        assert resp == "New Session"


@pytest.mark.asyncio
async def test_get_config():
    async with sio_client() as sio:
        resp = await request(
            sio,
            "get_config",
            {},
            use_ack=True,
        )

        for key, pair in [
            ("allow_anonymous_telemetry", bool),
            ("context_providers", list),
            ("retrieval_settings", dict),
            ("custom_commands", list),
            ("slash_commands", list),
        ]:
            assert key in resp
            assert isinstance(resp[key], pair)


@pytest.mark.asyncio
async def test_set_settings():
    async with sio_client() as sio:
        TEMP = 0.449

        future = asyncio.Future()

        def cb(data):
            future.set_result(True)
            assert data["data"]["completion_options"]["temperature"] == TEMP

        sio.on("message", cb)

        await send(
            sio,
            "set_temperature",
            {"temperature": TEMP},
        )

        await asyncio.wait_for(future, timeout=5)


@pytest.mark.asyncio
async def test_set_system_message():
    async with sio_client() as sio:
        SM = "SystemMessage"

        future = asyncio.Future()

        def cb(data):
            future.set_result(True)
            assert data["data"]["system_message"] == SM

        sio.on("message", cb)

        await send(
            sio,
            "set_system_message",
            {"system_message": SM},
        )

        await asyncio.wait_for(future, timeout=5)


@pytest.mark.asyncio
async def test_set_model_for_role():
    pass


@pytest.mark.asyncio
async def test_add_model_for_role():
    pass


@pytest.mark.asyncio
async def test_delete_model_at_index():
    pass
