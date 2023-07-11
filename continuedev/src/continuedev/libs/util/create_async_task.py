from typing import Coroutine, Union
import traceback
from .telemetry import capture_event
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
            print("Exception caught from async task: ", e)
            capture_event(unique_id or "None", "async_task_error", {
                "error_title": e.__str__() or e.__repr__(), "error_message": traceback.format_tb(e.__traceback__)
            })

    task.add_done_callback(callback)
    return task
