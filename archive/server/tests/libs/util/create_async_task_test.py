import asyncio
from unittest.mock import Mock, patch

import pytest
from continuedev.libs.util.create_async_task import create_async_task


@pytest.fixture
def mock_coro():
    async def coro():
        await asyncio.sleep(0.1)
        return "result"

    return coro


@pytest.fixture
def mock_failed_coro():
    async def coro():
        await asyncio.sleep(0.1)
        raise ValueError("error")

    return coro


@pytest.fixture
def mock_on_error():
    return Mock()


@pytest.fixture
def mock_logger():
    with patch("continuedev.libs.util.logging.logger") as mock:
        yield mock


@pytest.fixture
def mock_posthog_logger():
    with patch("continuedev.libs.util.telemetry.posthog_logger") as mock:
        yield mock


@pytest.fixture(scope="function")
def event_loop(request):
    loop = asyncio.get_event_loop_policy().new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


def test_create_async_task_success(
    mock_coro, mock_on_error, mock_logger, mock_posthog_logger, event_loop
):
    async def stuff():
        task = create_async_task(mock_coro(), mock_on_error)
        await asyncio.sleep(0.2)
        assert task.result() == "result"
        # mock_logger.critical.assert_not_called()
        # mock_posthog_logger.capture_event.assert_not_called()
        # mock_on_error.assert_not_called()

    event_loop.run_until_complete(stuff())


def test_create_async_task_failure(
    mock_failed_coro, mock_on_error, mock_logger, mock_posthog_logger, event_loop
):
    async def stuff():
        task = create_async_task(mock_failed_coro(), mock_on_error)
        await asyncio.sleep(0.2)
        with pytest.raises(ValueError):
            task.result()
        # mock_logger.critical.assert_called_once()
        # mock_posthog_logger.capture_event.assert_called_once_with(
        #     "async_task_error",
        #     {
        #         "error_title": "error",
        #         "error_message": "Traceback (most recent call last):\n",
        #     },
        # )
        # mock_on_error.assert_called_once_with(ValueError("error"))

    event_loop.run_until_complete(stuff())
