import json
from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

import websockets

from ...core.main import ChatMessage
from ..util.count_tokens import (
    DEFAULT_ARGS,
    compile_chat_messages,
    count_tokens,
    format_chat_messages,
)
from . import LLM


class TextGenUI(LLM):
    # this is model-specific
    model: str = "text-gen-ui"
    max_context_length: int = 2048
    server_url: str = "http://localhost:5000"
    streaming_url: str = "http://localhost:5005"
    verify_ssl: Optional[bool] = None

    requires_write_log = True

    write_log: Optional[Callable[[str], None]] = None

    class Config:
        arbitrary_types_allowed = True

    async def start(self, write_log: Callable[[str], None], **kwargs):
        self.write_log = write_log

    async def stop(self):
        pass

    @property
    def name(self):
        return self.model

    @property
    def context_length(self):
        return self.max_context_length

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.name, "max_tokens": 1024}

    def _transform_args(self, args):
        args = {
            **args,
            "max_new_tokens": args.get("max_tokens", 1024),
        }
        args.pop("max_tokens", None)
        return args

    def count_tokens(self, text: str):
        return count_tokens(self.name, text)

    async def stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        args = {**self.default_args, **kwargs}

        self.write_log(f"Prompt: \n\n{prompt}")
        completion = ""

        ws_url = f"{self.streaming_url.replace('http://', 'ws://').replace('https://', 'wss://')}"
        payload = json.dumps({"prompt": prompt, **self._transform_args(args)})
        async with websockets.connect(
            f"{ws_url}/api/v1/stream", ping_interval=None
        ) as websocket:
            await websocket.send(payload)

            while True:
                incoming_data = await websocket.recv()
                incoming_data = json.loads(incoming_data)

                match incoming_data["event"]:
                    case "text_stream":
                        completion += incoming_data["text"]
                        yield incoming_data["text"]
                    case "stream_end":
                        break

        self.write_log(f"Completion: \n\n{completion}")

    async def stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.name,
            messages,
            self.context_length,
            args["max_tokens"],
            None,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )
        args["stream"] = True

        async def generator():
            ws_url = f"{self.streaming_url.replace('http://', 'ws://').replace('https://', 'wss://')}"
            history = list(map(lambda x: x["content"], messages))
            payload = json.dumps(
                {
                    "user_input": messages[-1]["content"],
                    "history": {"internal": [history], "visible": [history]},
                    **self._transform_args(args),
                }
            )
            async with websockets.connect(
                f"{ws_url}/api/v1/chat-stream", ping_interval=None
            ) as websocket:
                await websocket.send(payload)

                prev = ""
                while True:
                    incoming_data = await websocket.recv()
                    incoming_data = json.loads(incoming_data)

                    match incoming_data["event"]:
                        case "text_stream":
                            visible = incoming_data["history"]["visible"][-1]
                            if len(visible) > 0:
                                yield {
                                    "role": "assistant",
                                    "content": visible[-1].replace(prev, ""),
                                }
                                prev = visible[-1]
                        case "stream_end":
                            break

        # Because quite often the first attempt fails, and it works thereafter
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        completion = ""
        async for chunk in generator():
            yield chunk
            if "content" in chunk:
                completion += chunk["content"]

        self.write_log(f"Completion: \n\n{completion}")

    async def complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        generator = self.stream_chat(
            [ChatMessage(role="user", content=prompt, summary=prompt)], **kwargs
        )

        completion = ""
        async for chunk in generator:
            if "content" in chunk:
                completion += chunk["content"]

        return completion
