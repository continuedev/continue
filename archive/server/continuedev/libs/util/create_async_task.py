import asyncio
import traceback
from typing import Callable, Coroutine, Optional

from .logging import logger
from .telemetry import posthog_logger


def create_async_task(
    coro: Coroutine, on_error: Optional[Callable[[Exception], Coroutine]] = None
):
    """asyncio.create_task and log errors by adding a callback"""
    task = asyncio.create_task(coro)

    def callback(future: asyncio.Future):
        try:
            future.result()
        except Exception as e:
            formatted_tb = "\n".join(traceback.format_exception(e))
            logger.critical(f"Exception caught from async task: {formatted_tb}")
            posthog_logger.capture_event(
                "async_task_error",
                {
                    "error_title": e.__str__() or e.__repr__(),
                    "error_message": "\n".join(traceback.format_exception(e)),
                },
            )

            # Log the error to the GUI
            if on_error is not None:
                asyncio.create_task(on_error(e))

    task.add_done_callback(callback)
    return task
