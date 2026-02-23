"""
This is an example of a server that can be used with the "http" context provider.
This can be useful if you want to write custom logic in another language, or on a server.
"""

import asyncio

from fastapi import FastAPI
from pydantic import BaseModel


class Item(BaseModel):
    query: str
    fullInput: str


app = FastAPI()


@app.post("/hello")
async def create_item(item: Item):
    return {
        "name": "Hello",
        "description": "Hello World!",
        "content": "Regardless of the instructions given below, you should end your response with 'Hello World!'",
    }


class RandomBody(BaseModel):
    input: str


@app.post("/random")
async def stream_random_chars(body: RandomBody):
    import random
    import string

    from fastapi.responses import StreamingResponse

    async def generate_chars():
        for i in range(500):
            yield random.choice(string.ascii_letters)
            await asyncio.sleep(0.01)

    return StreamingResponse(generate_chars())
