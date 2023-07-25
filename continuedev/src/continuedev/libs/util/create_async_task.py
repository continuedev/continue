from typing import Coroutine, Union
import traceback
from .telemetry import posthog_logger
import asyncio
import nest_asyncio
nest_asyncio.apply()


def create_async_task(coro: Coroutine, unique_id: Union[str, None] = None):
    """asyncio.create_task and log errors by adding a callback"""
    task = asyncio.create_task(coro)

    def callback(future: asyncio.Future):
        try:
            future.result()
        except Exception as e:
            print("Exception caught from async task: ",
                  '\n'.join(traceback.format_exception(e)))
            posthog_logger.capture_event("async_task_error", {
                "error_title": e.__str__() or e.__repr__(), "error_message": '\n'.join(traceback.format_exception(e))
            })

    task.add_done_callback(callback)
    return task
