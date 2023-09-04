import asyncio
import os
import random
import subprocess
from typing import Dict, List, Optional

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

openai = FastAPI()


class CompletionBody(BaseModel):
    prompt: str
    max_tokens: Optional[int] = 60
    stream: Optional[bool] = False

    class Config:
        extra = "allow"


@openai.post("/completions")
@openai.post("/v1/completions")
async def mock_completion(item: CompletionBody):
    prompt = item.prompt

    text = "This is a fake completion."

    if item.stream:

        async def stream_text():
            for i in range(len(text)):
                word = random.choice(prompt.split())
                yield {
                    "choices": [
                        {
                            "delta": {"role": "assistant", "content": word},
                            "finish_reason": None,
                            "index": 0,
                        }
                    ],
                    "created": 1677825464,
                    "id": "chatcmpl-6ptKyqKOGXZT6iQnqiXAH8adNLUzD",
                    "model": "gpt-3.5-turbo-0301",
                    "object": "chat.completion.chunk",
                }
                await asyncio.sleep(0.1)

        return StreamingResponse(stream_text(), media_type="text/plain")

    return {
        "id": "cmpl-uqkvlQyYK7bGYrRHQ0eXlWi7",
        "object": "text_completion",
        "created": 1589478378,
        "model": "gpt-3.5-turbo",
        "choices": [
            {
                "text": text,
                "index": 0,
                "logprobs": None,
                "finish_reason": "length",
            }
        ],
        "usage": {"prompt_tokens": 5, "completion_tokens": 7, "total_tokens": 12},
    }


class ChatBody(BaseModel):
    messages: List[Dict[str, str]]
    max_tokens: Optional[int] = None
    stream: Optional[bool] = False

    class Config:
        extra = "allow"


@openai.post("/v1/chat/completions")
async def mock_chat_completion(item: ChatBody):
    text = "This is a fake completion."

    if item.stream:

        async def stream_text():
            for i in range(len(text)):
                word = text[i]
                yield {
                    "choices": [
                        {
                            "delta": {"role": "assistant", "content": word},
                            "finish_reason": None,
                            "index": 0,
                        }
                    ],
                    "created": 1677825464,
                    "id": "chatcmpl-6ptKyqKOGXZT6iQnqiXAH8adNLUzD",
                    "model": "gpt-3.5-turbo-0301",
                    "object": "chat.completion.chunk",
                }
                await asyncio.sleep(0.1)

        return StreamingResponse(stream_text(), media_type="text/plain")

    return {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "model": "gpt-3.5-turbo-0613",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": text,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 9, "completion_tokens": 12, "total_tokens": 21},
    }


def start_openai(port: int = 8000):
    server = subprocess.Popen(
        [
            "uvicorn",
            "openai_mock:openai",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=os.path.dirname(__file__),
    )
    return server


if __name__ == "__main__":
    start_openai()
