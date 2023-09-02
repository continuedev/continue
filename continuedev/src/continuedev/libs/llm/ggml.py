import json
from typing import Any, Coroutine, Dict, Generator, List, Optional, Union

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import compile_chat_messages, format_chat_messages


class GGML(LLM):
    server_url: str = "http://localhost:8000"
    verify_ssl: Optional[bool] = None
    model: str = "ggml"

    timeout: int = 300

    class Config:
        arbitrary_types_allowed = True

    async def _stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.collect_args(**kwargs)
        args["stream"] = True

        messages = compile_chat_messages(
            self.model,
            with_history,
            self.context_length,
            args["max_tokens"],
            prompt,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )

        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        completion = ""
        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/v1/completions", json={"messages": messages, **args}
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        try:
                            chunk = line.decode("utf-8")
                            yield chunk
                            completion += chunk
                        except:
                            raise Exception(str(line))

        self.write_log(f"Completion: \n\n{completion}")

    async def _stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.collect_args(**kwargs)
        messages = compile_chat_messages(
            self.model,
            messages,
            self.context_length,
            args["max_tokens"],
            None,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )
        args["stream"] = True

        async def generator():
            async with aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
                timeout=aiohttp.ClientTimeout(total=self.timeout),
            ) as client_session:
                async with client_session.post(
                    f"{self.server_url}/v1/chat/completions",
                    json={"messages": messages, **args},
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    # This is streaming application/json instaed of text/event-stream
                    async for line, end in resp.content.iter_chunks():
                        json_chunk = line.decode("utf-8")
                        chunks = json_chunk.split("\n")
                        for chunk in chunks:
                            if (
                                chunk.strip() == ""
                                or json_chunk.startswith(": ping - ")
                                or json_chunk.startswith("data: [DONE]")
                            ):
                                continue
                            try:
                                yield json.loads(chunk[6:])["choices"][0][
                                    "delta"
                                ]  # {"role": "assistant", "content": "..."}
                            except:
                                pass

        # Because quite often the first attempt fails, and it works thereafter
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        completion = ""
        try:
            async for chunk in generator():
                yield chunk
                if "content" in chunk:
                    completion += chunk["content"]
        except:
            async for chunk in generator():
                yield chunk
                if "content" in chunk:
                    completion += chunk["content"]

        self.write_log(f"Completion: \n\n{completion}")

    async def _complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        args = self.collect_args(**kwargs)

        self.write_log(f"Prompt: \n\n{prompt}")
        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/v1/completions",
                json={
                    "prompt": prompt,
                    **args,
                },
            ) as resp:
                text = await resp.text()
                try:
                    completion = json.loads(text)["choices"][0]["text"]
                    self.write_log(f"Completion: \n\n{completion}")
                    return completion
                except Exception as e:
                    raise Exception(
                        f"Error calling /completion endpoint: {e}\n\nResponse text: {text}"
                    )
