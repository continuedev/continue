from typing import Any, Awaitable, Callable


AsyncFunc = Callable[..., Awaitable[Any]]
