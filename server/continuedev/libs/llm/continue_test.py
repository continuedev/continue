import json

import aiohttp
import requests

IP = "129.213.24.72"


def requests_test() -> None:
    requests.post(
        f"http://{IP}:8000/v1/completions",
        json={
            "prompt": "Hello! What is your name?",
            "model": "mistralai/Mistral-7B-Instruct-v0.1",
        },
    )


async def basic_test():
    async with aiohttp.ClientSession() as client_session, client_session.post(
        f"http://{IP}:8000/v1/completions",
        json={
            "prompt": "Hello! What is your name?",
            "model": "mistralai/Mistral-7B-Instruct-v0.1",
        },
    ) as resp:
        return await resp.json()


async def streaming_test():
    headers = {"Content-Type": "application/json"}

    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=3600),
        headers=headers,
        trust_env=True,
    ) as client_session, client_session.post(
        f"http://{IP}:8000/v1/completions",
        json={
            "prompt": "Hello! What is your name?",
            "model": "mistralai/Mistral-7B-Instruct-v0.1",
            "stream": True,
        },
        headers=headers,
    ) as resp:
        if resp.status != 200:
            msg = f"Error calling /completions endpoint: {resp.status}"
            raise Exception(msg)

        async for line in resp.content.iter_any():
            if line:
                chunks = line.decode("utf-8")
                for chunk in chunks.split("\n"):
                    if (
                        chunk.startswith((": ping - ", "data: [DONE]")) or chunk.strip() == ""
                    ):
                        continue
                    elif chunk.startswith("data: "):
                        chunk = chunk[6:]
                    try:
                        j = json.loads(chunk)
                    except Exception:
                        continue
                    if (
                        "choices" in j
                        and len(j["choices"]) > 0
                        and "text" in j["choices"][0]
                    ):
                        yield j["choices"][0]["text"]


async def main() -> None:
    # Test requests (you mentioned that this worked before)
    requests_test()

    # Test non-streaming response
    await basic_test()

    # Test streaming response, like what happens in Continue
    async for _i in streaming_test():
        pass


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
