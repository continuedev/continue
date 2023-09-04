import json
from typing import Any, List, Optional

import websockets

from ...core.main import ChatMessage
from . import LLM
from .prompts.edit import simplified_edit_prompt


class TextGenUI(LLM):
    model: str = "text-gen-ui"
    server_url: str = "http://localhost:5000"
    streaming_url: str = "http://localhost:5005"
    verify_ssl: Optional[bool] = None

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, options) -> Any:
        args = super().collect_args(options)
        args = {**args, "max_new_tokens": options.max_tokens}
        args.pop("max_tokens", None)
        return args

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        ws_url = f"{self.streaming_url.replace('http://', 'ws://').replace('https://', 'wss://')}"
        payload = json.dumps({"prompt": prompt, "stream": True, **args})
        async with websockets.connect(
            f"{ws_url}/api/v1/stream", ping_interval=None
        ) as websocket:
            await websocket.send(payload)

            while True:
                incoming_data = await websocket.recv()
                incoming_data = json.loads(incoming_data)

                match incoming_data["event"]:
                    case "text_stream":
                        yield incoming_data["text"]
                    case "stream_end":
                        break

    async def _stream_chat(self, messages: List[ChatMessage], options):
        args = self.collect_args(options)

        async def generator():
            ws_url = f"{self.streaming_url.replace('http://', 'ws://').replace('https://', 'wss://')}"
            history = list(map(lambda x: x["content"], messages))
            payload = json.dumps(
                {
                    "user_input": messages[-1]["content"],
                    "history": {"internal": [history], "visible": [history]},
                    "stream": True,
                    **args,
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

        async for chunk in generator():
            yield chunk
