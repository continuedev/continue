from typing import Any, Callable, List, Optional, TypeVar
from ...core.autopilot import Autopilot
import socketio

from pydantic import BaseModel

from ...models.websockets import WebsocketsMessage
from ...core.main import ContextItem, SessionState, SessionUpdate, StepDescription
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
    create_float_node,
    create_obj_node,
    create_string_node,
    display_llm_class,
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

    def __init__(
        self,
        window_id: str,
        sio: socketio.AsyncServer,
        sid: str,
        get_autopilot: Callable[[SessionState], Autopilot],
        get_context_item: Callable[[str, str], ContextItem],
    ):
        self.window_id = window_id
        self.messenger = SocketIOMessenger(sio, sid)
        self.get_autopilot = get_autopilot
        self.get_context_item = get_context_item

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

        elif msg.message_type == "set_current_session_title":
            self.set_current_session_title(data["title"])
        elif msg.message_type == "show_context_virtual_file":
            self.show_context_virtual_file(data.get("index", None))
        elif msg.message_type == "load_session":
            self.load_session(data.get("session_id", None))
        elif msg.message_type == "set_system_message":
            self.set_system_message(data["message"])
        elif msg.message_type == "set_temperature":
            self.set_temperature(float(data["temperature"]))
        elif msg.message_type == "add_model_for_role":
            self.add_model_for_role(data["role"], data["model_class"], data["model"])
        elif msg.message_type == "set_model_for_role_from_index":
            self.set_model_for_role_from_index(data["role"], data["index"])
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

    def set_current_session_title(self, title: str):
        self.session.autopilot.set_current_session_title(title)

    def set_system_message(self, message: str):
        self.session.autopilot.sdk.config.system_message = message
        self.session.autopilot.sdk.models.set_main_config_params(
            message, self.session.autopilot.sdk.config.temperature
        )

        create_async_task(
            self.session.autopilot.set_config_attr(
                ["system_message"], create_string_node(message)
            ),
            self.on_error,
        )
        posthog_logger.capture_event("set_system_message", {"system_message": message})

    def set_temperature(self, temperature: float):
        self.session.autopilot.sdk.config.temperature = temperature
        create_async_task(
            self.session.autopilot.set_config_attr(
                ["temperature"], create_float_node(temperature)
            ),
            self.on_error,
        )
        posthog_logger.capture_event("set_temperature", {"temperature": temperature})

    def set_model_for_role_from_index(self, role: str, index: int):
        async def async_stuff():
            models = self.session.autopilot.sdk.config.models

            # Set models in SDK
            temp = models.default
            models.default = models.saved[index]
            models.saved[index] = temp
            await self.session.autopilot.sdk.start_model(models.default)

            # Set models in config.py
            JOINER = ",\n\t\t"
            models_args = {
                "saved": f"[{JOINER.join([display_llm_class(llm) for llm in models.saved])}]",
                ("default" if role == "*" else role): display_llm_class(models.default),
            }

            await self.session.autopilot.set_config_attr(
                ["models"],
                create_obj_node("Models", models_args),
            )

            for other_role in ALL_MODEL_ROLES:
                if other_role != "default":
                    models.__setattr__(other_role, models.default)

            await self.session.autopilot.sdk.update_ui()

        create_async_task(async_stuff(), self.on_error)

    def add_model_for_role(self, role: str, model_class: str, model: Any):
        models = self.session.autopilot.sdk.config.models

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

            async def async_stuff():
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

                # Set and start the new default model
                new_model = MODEL_CLASSES[model_class](**model)
                models.default = new_model
                await self.session.autopilot.sdk.start_model(models.default)

                # Construct and set the new models object
                JOINER = ",\n\t\t"
                saved_model_strings = set(
                    [display_llm_class(llm) for llm in saved_models]
                )
                models_args = {
                    "default": display_llm_class(
                        models.default, True, default_model_display_overrides
                    ),
                    "saved": f"[{JOINER.join(saved_model_strings)}]",
                }

                await self.session.autopilot.set_config_attr(
                    ["models"],
                    create_obj_node("Models", models_args),
                )

                # Set all roles (in-memory) to the new default model
                for role in ALL_MODEL_ROLES:
                    if role != "default":
                        models.__setattr__(role, models.default)

                # Display setup help
                # await self.session.autopilot.continue_sdk.run_step(
                #     SetupModelStep(model_class=model_class)
                # )

            create_async_task(async_stuff(), self.on_error)
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

    _running_autopilot: Optional[Autopilot] = None

    async def run_from_state(self, state: SessionState):
        autopilot = self.get_autopilot(state)
        self._running_autopilot = autopilot
        await autopilot.run()
        self._running_autopilot = None

    async def stop_session(self):
        if self._running_autopilot is not None:
            self._running_autopilot.stopped = True

    async def send_session_update(self, session_update: SessionUpdate):
        await self.messenger.send("session_update", session_update.dict())

    async def add_context_item(self, item: ContextItem):
        await self.messenger.send("add_context_item", item.dict())

    async def get_session_title(self, history: List[StepDescription]) -> str:
        return await self.get_autopilot(
            SessionState(history=history, context_items=[])
        ).get_session_title()

    # endregion
