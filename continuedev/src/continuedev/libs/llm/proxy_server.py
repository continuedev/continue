
import json
import traceback
from typing import Any, Callable, Coroutine, Dict, Generator, List, Literal, Union
import aiohttp
from ...core.main import ChatMessage
from ..llm import LLM
from ..util.telemetry import posthog_logger
from ..util.count_tokens import DEFAULT_ARGS, compile_chat_messages, count_tokens, format_chat_messages
import certifi
import ssl

ca_bundle_path = certifi.where()
ssl_context = ssl.create_default_context(cafile=ca_bundle_path)

# SERVER_URL = "http://127.0.0.1:8080"
SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app"


class ProxyServer(LLM):
    unique_id: str
    name: str
    default_model: Literal["gpt-3.5-turbo", "gpt-4"]
    write_log: Callable[[str], None]

    def __init__(self, unique_id: str, default_model: Literal["gpt-3.5-turbo", "gpt-4"], system_message: str = None, write_log: Callable[[str], None] = None):
        self.unique_id = unique_id
        self.default_model = default_model
        self.system_message = system_message
        self.name = default_model
        self.write_log = write_log

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.default_model}

    def count_tokens(self, text: str):
        return count_tokens(self.default_model, text)

    def get_headers(self):
        # headers with unique id
        return {"unique_id": self.unique_id}

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        messages = compile_chat_messages(
            args["model"], with_history, args["max_tokens"], prompt, functions=None, system_message=self.system_message)
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl_context=ssl_context)) as session:
            async with session.post(f"{SERVER_URL}/complete", json={
                "messages": messages,
                **args
            }, headers=self.get_headers()) as resp:
                if resp.status != 200:
                    raise Exception(await resp.text())

                response_text = await resp.text()
                self.write_log(f"Completion: \n\n{response_text}")
                return response_text

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, Generator[Union[Any, List, Dict], None, None]]:
        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            args["model"], messages, args["max_tokens"], None, functions=args.get("functions", None), system_message=self.system_message)
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")

        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl_context=ssl_context)) as session:
            async with session.post(f"{SERVER_URL}/stream_chat", json={
                "messages": messages,
                **args
            }, headers=self.get_headers()) as resp:
                # This is streaming application/json instaed of text/event-stream
                completion = ""
                if resp.status != 200:
                    raise Exception(await resp.text())
                async for line in resp.content.iter_chunks():
                    if line[1]:
                        try:
                            json_chunk = line[0].decode("utf-8")
                            json_chunk = "{}" if json_chunk == "" else json_chunk
                            chunks = json_chunk.split("\n")
                            for chunk in chunks:
                                if chunk.strip() != "":
                                    loaded_chunk = json.loads(chunk)
                                    yield loaded_chunk
                                    if "content" in loaded_chunk:
                                        completion += loaded_chunk["content"]
                        except Exception as e:
                            posthog_logger.capture_event(self.unique_id, "proxy_server_parse_error", {
                                "error_title": "Proxy server stream_chat parsing failed", "error_message": '\n'.join(traceback.format_exception(e))})
                    else:
                        break

                self.write_log(f"Completion: \n\n{completion}")

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.default_model, with_history, args["max_tokens"], prompt, functions=args.get("functions", None), system_message=self.system_message)
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")

        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl_context=ssl_context)) as session:
            async with session.post(f"{SERVER_URL}/stream_complete", json={
                "messages": messages,
                **args
            }, headers=self.get_headers()) as resp:
                completion = ""
                if resp.status != 200:
                    raise Exception(await resp.text())
                async for line in resp.content.iter_any():
                    if line:
                        try:
                            decoded_line = line.decode("utf-8")
                            yield decoded_line
                            completion += decoded_line
                        except:
                            raise Exception(str(line))
                self.write_log(f"Completion: \n\n{completion}")
