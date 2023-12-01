import asyncio
import os
import traceback

from dotenv import load_dotenv
from litellm import acompletion

load_dotenv()


async def completion_call():
    try:
        print("test acompletion + streaming")
        response = await acompletion(
            model="gpt-3.5-turbo",
            messages=[{"content": "Hello, how are you?", "role": "user"}],
            stream=True,
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        print(f"response: {response}")
        async for chunk in response:
            print(chunk)
    except Exception:
        print(f"error occurred: {traceback.format_exc()}")
        pass


async def complete_n_times(n: int):
    await asyncio.gather(*[completion_call() for _ in range(n)])


asyncio.run(completion_call())
