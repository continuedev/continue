import asyncio
import os

from dotenv import load_dotenv
from litellm import acompletion

load_dotenv()


async def completion_call() -> None:
    try:
        response = await acompletion(
            model="gpt-3.5-turbo",
            messages=[{"content": "Hello, how are you?", "role": "user"}],
            stream=True,
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        async for _chunk in response:
            pass
    except Exception:
        pass


async def complete_n_times(n: int) -> None:
    await asyncio.gather(*[completion_call() for _ in range(n)])


asyncio.run(completion_call())
