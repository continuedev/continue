import json
from typing import Any, Callable, Dict, List, Union

import websockets
from pydantic import Field

from ...core.main import ChatMessage
from .base import LLM
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplest_edit_prompt


class TextGenWebUI(LLM):
    """
    TextGenWebUI is a comprehensive, open-source language model UI and local server. You can set it up with an OpenAI-compatible server plugin, but if for some reason that doesn't work, you can use this class like so:

    ```python title="~/.continue/config.py"
<<<<<<<< HEAD:server/continuedev/libs/llm/text_gen_interface.py
    from continuedev.libs.llm.text_gen_interface import TextGenUI
========
    from continuedev.libs.llm.text_gen_webui import TextGenWebUI
>>>>>>>> 16b0a48035350d350e05ae5fe17478ae78042904:server/continuedev/libs/llm/text_gen_webui.py

    config = ContinueConfig(
        ...
        models=Models(
            default=TextGenWebUI(
                model="<MODEL_NAME>",
            )
        )
    )
    ```
    """

    model: str = "text-gen-webui"
    server_url: str = Field(
        "http://localhost:5000", description="URL of your TextGenWebUI server"
    )
    streaming_url: str = Field(
        "http://localhost:5005",
        description="URL of your TextGenWebUI streaming server (separate from main server URL)",
    )

    prompt_templates = {
        "edit": simplest_edit_prompt,
    }

    template_messages: Union[
        Callable[[List[Dict[str, str]]], str], None
    ] = llama2_template_messages

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

                incoming_data_event = incoming_data["event"]

                if incoming_data_event == "text_stream":
                    yield incoming_data["text"]
                elif incoming_data_event == "stream_end":
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

                    incoming_data_event = incoming_data["event"]

                    if incoming_data_event == "text_stream":
                        visible = incoming_data["history"]["visible"][-1]
                        if len(visible) > 0:
                            yield {
                                "role": "assistant",
                                "content": visible[-1].replace(prev, ""),
                            }
                            prev = visible[-1]
                    elif incoming_data_event == "stream_end":
                        break

        async for chunk in generator():
            yield chunk
