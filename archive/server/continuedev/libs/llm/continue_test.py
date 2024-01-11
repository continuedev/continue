import json
import aiohttp
import requests

IP = "129.213.24.72"


def requests_test():
    resp = requests.post(
        f"http://{IP}:8000/v1/completions",
        json={
            "prompt": "Hello! What is your name?",
            "model": "mistralai/Mistral-7B-Instruct-v0.1",
        },
    )
    print(resp.json())


async def basic_test():
    async with aiohttp.ClientSession() as client_session:
        async with client_session.post(
            f"http://{IP}:8000/v1/completions",
            json={
                "prompt": "Hello! What is your name?",
                "model": "mistralai/Mistral-7B-Instruct-v0.1",
            },
        ) as resp:
            j = await resp.json()
            print(j)
            return j


async def streaming_test():
    headers = {"Content-Type": "application/json"}

    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=3600),
        headers=headers,
        trust_env=True,
    ) as client_session:
        async with client_session.post(
            f"http://{IP}:8000/v1/completions",
            json={
                "prompt": "Hello! What is your name?",
                "model": "mistralai/Mistral-7B-Instruct-v0.1",
                "stream": True,
            },
            headers=headers,
        ) as resp:
            if resp.status != 200:
                raise Exception(f"Error calling /completions endpoint: {resp.status}")

            async for line in resp.content.iter_any():
                if line:
                    chunks = line.decode("utf-8")
                    for chunk in chunks.split("\n"):
                        if (
                            chunk.startswith(": ping - ")
                            or chunk.startswith("data: [DONE]")
                            or chunk.strip() == ""
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


async def main():
    # Test requests (you mentioned that this worked before)
    requests_test()

    # Test non-streaming response
    await basic_test()

    # Test streaming response, like what happens in Continue
    async for i in streaming_test():
        print(i)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
