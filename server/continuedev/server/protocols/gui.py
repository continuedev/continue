from typing import Any, Callable, Dict, List, Optional, TypeVar

from ...core.config import ContinueConfig
from ...core.autopilot import Autopilot
import socketio
import uuid

from pydantic import BaseModel

from ...models.websockets import WebsocketsMessage
from ...core.main import ContextItem, SessionState, SessionUpdate, Step, StepDescription
from ...core.models import ALL_MODEL_ROLES, MODEL_CLASSES, MODEL_MODULE_NAMES
from ...core.steps import DisplayErrorStep
from ...libs.llm.prompts.chat import (
    llama2_template_messages,
    sqlcoder_template_messages,
    template_alpaca_messages,
)
from ...libs.llm.prompts.edit import codellama_edit_prompt, alpaca_edit_prompt
from ...libs.util.create_async_task import create_async_task
from ...libs.util.edit_config import (
    add_config_import,
    create_obj_node,
    display_llm_class,
    edit_config_property,
)
from ...libs.util.telemetry import posthog_logger
from ..websockets_messenger import SocketIOMessenger


T = TypeVar("T", bound=BaseModel)

# You should probably abstract away the websocket stuff into a separate class


class GUIProtocolServer:
    window_id: str
    messenger: SocketIOMessenger

    get_autopilot: Callable[[SessionState], Autopilot]
    get_context_item: Callable[[str, str], ContextItem]
    get_config: Callable[[], ContinueConfig]
    reload_config: Callable[[], None]

    def __init__(
        self,
        window_id: str,
        sio: socketio.AsyncServer,
        sid: str,
        get_autopilot: Callable[[SessionState], Autopilot],
        get_context_item: Callable[[str, str], ContextItem],
        get_config: Callable[[], ContinueConfig],
        reload_config: Callable[[], None],
    ):
        self.window_id = window_id
        self.messenger = SocketIOMessenger(sio, sid)
        self.get_autopilot = get_autopilot
        self.get_context_item = get_context_item
        self.get_config = get_config
        self.reload_config = reload_config

    def on_error(self, e: Exception):
        # TODO
        return self.session.autopilot.sdk.run_step(DisplayErrorStep.from_exception(e))

    async def handle_json(self, msg: WebsocketsMessage):
        data = msg.data
        if msg.message_type == "run_from_state":
            await self.run_from_state(SessionState.parse_obj(data["state"]))
        elif msg.message_type == "stop_session":
            await self.stop_session()
        elif msg.message_type == "get_context_item":
            return (await self.get_context_item(data["id"], data["query"])).dict()
        elif msg.message_type == "get_session_title":
            return await self.get_session_title(
                [StepDescription(**step) for step in data["history"]]
            )
        elif msg.message_type == "get_config":
            return self.get_config().dict()

        elif msg.message_type == "show_context_virtual_file":
            self.show_context_virtual_file(data.get("index", None))
        elif msg.message_type == "load_session":
            self.load_session(data.get("session_id", None))
        elif msg.message_type == "set_system_message":
            sys_message = data["system_message"]
            ContinueConfig.set_system_message(sys_message)
            posthog_logger.capture_event(
                "set_system_message", {"system_message": sys_message}
            )
            await self.reload_config()
            await self.send_config_update()
        elif msg.message_type == "set_temperature":
            ContinueConfig.set_temperature(float(data["temperature"]))
            await self.reload_config()
            await self.send_config_update()
        elif msg.message_type == "add_model_for_role":
            await self.add_model_for_role(
                data["role"], data["model_class"], data["model"]
            )
        elif msg.message_type == "set_model_for_role_from_index":
            await self.set_model_for_role_from_index(data["role"], data["index"])
        elif msg.message_type == "save_context_group":
            self.save_context_group(
                data["title"], [ContextItem(**item) for item in data["context_items"]]
            )
        elif msg.message_type == "select_context_group":
            self.select_context_group(data["id"])
        elif msg.message_type == "delete_context_group":
            self.delete_context_group(data["id"])
        elif msg.message_type == "preview_context_item":
            self.preview_context_item(data["id"])

    def show_context_virtual_file(self, index: Optional[int] = None):
        async def async_stuff():
            if index is None:
                context_items = (
                    await self.session.autopilot.context_manager.get_selected_items()
                )
            elif index < len(self.session.autopilot.sdk.history.timeline):
                context_items = self.session.autopilot.sdk.history.timeline[
                    index
                ].context_used

            ctx = "\n\n-----------------------------------\n\n".join(
                ["These are the context items that will be passed to the LLM"]
                + list(map(lambda x: x.content, context_items))
            )
            await self.session.autopilot.ide.showVirtualFile(
                "Continue - Selected Context", ctx
            )

        create_async_task(
            async_stuff(),
            self.on_error,
        )

    def select_context_item(self, id: str, query: str):
        """Called when user selects an item from the dropdown"""
        create_async_task(
            self.session.autopilot.select_context_item(id, query), self.on_error
        )

    def select_context_item_at_index(self, id: str, query: str, index: int):
        """Called when user selects an item from the dropdown for prev UserInputStep"""
        create_async_task(
            self.session.autopilot.select_context_item_at_index(id, query, index),
            self.on_error,
        )

    def preview_context_item(self, id: str):
        """Called when user clicks on an item from the dropdown"""
        create_async_task(
            self.session.autopilot.context_manager.preview_context_item(id),
            self.on_error,
        )

    # def load_session(self, session_id: Optional[str] = None):
    #     async def load_and_tell_to_reconnect():
    #         new_session_id = await session_manager.load_session(
    #             self.session.session_id, session_id
    #         )
    #         await self._send_json(
    #             "reconnect_at_session", {"session_id": new_session_id}
    #         )

    #     create_async_task(load_and_tell_to_reconnect(), self.on_error)

    #     posthog_logger.capture_event("load_session", {"session_id": session_id})

    async def set_model_for_role_from_index(self, role: str, index: int):
        models = self.get_config().models
        temp = models.default
        models.default = models.saved[index]
        models.saved[index] = temp

        ContinueConfig.set_models(models, role)
        await self.reload_config()
        await self.send_config_update()

    async def add_model_for_role(self, role: str, model_class: str, model: Any):
        models = self.get_config().models

        model_copy = model.copy()
        if "api_key" in model_copy:
            del model_copy["api_key"]
        if "hf_token" in model_copy:
            del model_copy["hf_token"]

        posthog_logger.capture_event(
            "select_model_for_role",
            {"role": role, "model_class": model_class, "model": model_copy},
        )

        if role == "*":
            # Remove all previous models in roles and place in saved
            saved_models = models.saved
            existing_saved_models = set(
                [display_llm_class(llm) for llm in saved_models]
            )
            for role in ALL_MODEL_ROLES:
                val = models.__getattribute__(role)
                if (
                    val is not None
                    and display_llm_class(val) not in existing_saved_models
                ):
                    saved_models.append(val)
                    existing_saved_models.add(display_llm_class(val))
                models.__setattr__(role, None)

            # Add the requisite import to config.py
            default_model_display_overrides = {}
            add_config_import(
                f"from continuedev.libs.llm.{MODEL_MODULE_NAMES[model_class]} import {model_class}"
            )
            if "template_messages" in model:
                add_config_import(
                    f"from continuedev.libs.llm.prompts.chat import {model['template_messages']}"
                )
                sqtm = sqlcoder_template_messages("<MY_DATABASE_SCHEMA>")
                sqtm.__name__ = 'sqlcoder_template_messages("<MY_DATABASE_SCHEMA>")'
                model["template_messages"] = {
                    "llama2_template_messages": llama2_template_messages,
                    "template_alpaca_messages": template_alpaca_messages,
                    "sqlcoder_template_messages": sqtm,
                }[model["template_messages"]]

            if "prompt_templates" in model and "edit" in model["prompt_templates"]:
                default_model_display_overrides[
                    "prompt_templates"
                ] = f"""{{"edit": {model["prompt_templates"]["edit"]}}}"""
                add_config_import(
                    f"from continuedev.libs.llm.prompts.edit import {model['prompt_templates']['edit']}"
                )
                model["prompt_templates"]["edit"] = {
                    "codellama_edit_prompt": codellama_edit_prompt,
                    "alpaca_edit_prompt": alpaca_edit_prompt,
                }[model["prompt_templates"]["edit"]]

            # Set the new default model
            new_model = MODEL_CLASSES[model_class](**model)
            models.default = new_model

            # Construct and set the new models object
            JOINER = ",\n\t\t"
            saved_model_strings = set([display_llm_class(llm) for llm in saved_models])
            models_args = {
                "default": display_llm_class(
                    models.default, True, default_model_display_overrides
                ),
                "saved": f"[{JOINER.join(saved_model_strings)}]",
            }

            edit_config_property(
                ["models"],
                create_obj_node("Models", models_args),
            )
            await self.reload_config()
            await self.send_config_update()
        else:
            # TODO
            pass

    def save_context_group(self, title: str, context_items: List[ContextItem]):
        create_async_task(
            self.session.autopilot.save_context_group(title, context_items),
            self.on_error,
        )

    def select_context_group(self, id: str):
        create_async_task(
            self.session.autopilot.select_context_group(id), self.on_error
        )

    def delete_context_group(self, id: str):
        create_async_task(
            self.session.autopilot.delete_context_group(id), self.on_error
        )

    # region: Send data to GUI

    _running_autopilots: Dict[str, Autopilot] = {}

    async def run_from_state(self, state: SessionState, step: Optional[Step] = None):
        autopilot = self.get_autopilot(state)
        cancel_token = str(uuid.uuid4())
        self._running_autopilots[cancel_token] = autopilot
        await autopilot.run(step=step)
        del self._running_autopilots[cancel_token]

    async def stop_session(self):
        for autopilot in self._running_autopilots.values():
            autopilot.stopped = True

    async def send_session_update(self, session_update: SessionUpdate):
        await self.messenger.send("session_update", session_update.dict())

    async def get_session_state(self) -> SessionState:
        return await self.messenger.send_and_receive(
            {}, SessionState, "get_session_state"
        )

    async def add_context_item(self, item: ContextItem):
        await self.messenger.send("add_context_item", item.dict())

    async def send_config_update(self):
        await self.messenger.send("config_update", self.get_config().dict())

    async def get_session_title(self, history: List[StepDescription]) -> str:
        return await self.get_autopilot(
            SessionState(history=history, context_items=[])
        ).get_session_title()

    # endregion
