import json
import traceback
from typing import Any, Callable, Coroutine, Dict, Generator, List, Literal, Union, Optional
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

MAX_TOKENS_FOR_MODEL = {
    "gpt-3.5-turbo": 4096,
    "gpt-3.5-turbo-0613": 4096,
    "gpt-3.5-turbo-16k": 16384,
    "gpt-4": 8192,
}


class ProxyServer(LLM):
    model: str
    system_message: Optional[str]

    unique_id: str = None
    write_log: Callable[[str], None] = None
    _client_session: aiohttp.ClientSession

    requires_unique_id = True
    requires_write_log = True

    async def start(self, *, api_key: Optional[str] = None, **kwargs):
        self._client_session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(ssl_context=ssl_context))
        self.write_log = kwargs["write_log"]
        self.unique_id = kwargs["unique_id"]

    async def stop(self):
        await self._client_session.close()

    @property
    def name(self):
        return self.model

    @property
    def context_length(self):
        return MAX_TOKENS_FOR_MODEL[self.model]

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.model}

    def count_tokens(self, text: str):
        return count_tokens(self.model, text)

    def get_headers(self):
        # headers with unique id
        return {"unique_id": self.unique_id}

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        messages = compile_chat_messages(
            args["model"], with_history, self.context_length, args["max_tokens"], prompt, functions=None, system_message=self.system_message)
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        async with self._client_session as session:
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
            args["model"], messages, self.context_length, args["max_tokens"], None, functions=args.get("functions", None), system_message=self.system_message)
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")

        async with self._client_session as session:
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
            self.model, with_history, self.context_length, args["max_tokens"], prompt, functions=args.get("functions", None), system_message=self.system_message)
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")

        async with self._client_session as session:
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
