import asyncio
import json
import traceback
from typing import Any, List, Optional, Type, TypeVar

from fastapi import APIRouter, Depends, WebSocket
from pydantic import BaseModel
from starlette.websockets import WebSocketDisconnect, WebSocketState
from uvicorn.main import Server

from ..core.main import ContextItem
from ..core.models import ALL_MODEL_ROLES, MODEL_CLASSES, MODEL_MODULE_NAMES
from ..core.steps import DisplayErrorStep
from ..libs.llm.prompts.chat import llama2_template_messages, template_alpaca_messages
from ..libs.util.create_async_task import create_async_task
from ..libs.util.edit_config import (
    add_config_import,
    create_float_node,
    create_obj_node,
    create_string_node,
    display_llm_class,
)
from ..libs.util.logging import logger
from ..libs.util.queue import AsyncSubscriptionQueue
from ..libs.util.telemetry import posthog_logger
from ..plugins.steps.setup_model import SetupModelStep
from .session_manager import Session, session_manager

router = APIRouter(prefix="/gui", tags=["gui"])

# Graceful shutdown by closing websockets
original_handler = Server.handle_exit


class AppStatus:
    should_exit = False

    @staticmethod
    def handle_exit(*args, **kwargs):
        AppStatus.should_exit = True
        logger.debug("Shutting down")
        original_handler(*args, **kwargs)


Server.handle_exit = AppStatus.handle_exit


async def websocket_session(session_id: str) -> Session:
    return await session_manager.get_session(session_id)


T = TypeVar("T", bound=BaseModel)

# You should probably abstract away the websocket stuff into a separate class


class GUIProtocolServer:
    websocket: WebSocket
    session: Session
    sub_queue: AsyncSubscriptionQueue = AsyncSubscriptionQueue()

    def __init__(self, session: Session):
        self.session = session

    async def _send_json(self, message_type: str, data: Any):
        if self.websocket.application_state == WebSocketState.DISCONNECTED:
            return
        await self.websocket.send_json({"messageType": message_type, "data": data})

    async def _receive_json(self, message_type: str, timeout: int = 20) -> Any:
        try:
            return await asyncio.wait_for(
                self.sub_queue.get(message_type), timeout=timeout
            )
        except asyncio.TimeoutError:
            raise Exception("GUI Protocol _receive_json timed out after 20 seconds")

    async def _send_and_receive_json(
        self, data: Any, resp_model: Type[T], message_type: str
    ) -> T:
        await self._send_json(message_type, data)
        resp = await self._receive_json(message_type)
        return resp_model.parse_obj(resp)

    def on_error(self, e: Exception):
        return self.session.autopilot.continue_sdk.run_step(
            DisplayErrorStep.from_exception(e)
        )

    def handle_json(self, message_type: str, data: Any):
        if message_type == "main_input":
            self.on_main_input(data["input"])
        elif message_type == "step_user_input":
            self.on_step_user_input(data["input"], data["index"])
        elif message_type == "refinement_input":
            self.on_refinement_input(data["input"], data["index"])
        elif message_type == "reverse_to_index":
            self.on_reverse_to_index(data["index"])
        elif message_type == "retry_at_index":
            self.on_retry_at_index(data["index"])
        elif message_type == "clear_history":
            self.on_clear_history()
        elif message_type == "set_current_session_title":
            self.set_current_session_title(data["title"])
        elif message_type == "delete_at_index":
            self.on_delete_at_index(data["index"])
        elif message_type == "delete_context_with_ids":
            self.on_delete_context_with_ids(data["ids"], data.get("index", None))
        elif message_type == "toggle_adding_highlighted_code":
            self.on_toggle_adding_highlighted_code()
        elif message_type == "set_editing_at_ids":
            self.on_set_editing_at_ids(data["ids"])
        elif message_type == "show_logs_at_index":
            self.on_show_logs_at_index(data["index"])
        elif message_type == "show_context_virtual_file":
            self.show_context_virtual_file(data.get("index", None))
        elif message_type == "select_context_item":
            self.select_context_item(data["id"], data["query"])
        elif message_type == "select_context_item_at_index":
            self.select_context_item_at_index(data["id"], data["query"], data["index"])
        elif message_type == "load_session":
            self.load_session(data.get("session_id", None))
        elif message_type == "edit_step_at_index":
            self.edit_step_at_index(data.get("user_input", ""), data["index"])
        elif message_type == "set_system_message":
            self.set_system_message(data["message"])
        elif message_type == "set_temperature":
            self.set_temperature(float(data["temperature"]))
        elif message_type == "add_model_for_role":
            self.add_model_for_role(data["role"], data["model_class"], data["model"])
        elif message_type == "set_model_for_role_from_index":
            self.set_model_for_role_from_index(data["role"], data["index"])
        elif message_type == "save_context_group":
            self.save_context_group(
                data["title"], [ContextItem(**item) for item in data["context_items"]]
            )
        elif message_type == "select_context_group":
            self.select_context_group(data["id"])
        elif message_type == "delete_context_group":
            self.delete_context_group(data["id"])

    def on_main_input(self, input: str):
        # Do something with user input
        create_async_task(
            self.session.autopilot.accept_user_input(input), self.on_error
        )

    def on_reverse_to_index(self, index: int):
        # Reverse the history to the given index
        create_async_task(self.session.autopilot.reverse_to_index(index), self.on_error)

    def on_step_user_input(self, input: str, index: int):
        create_async_task(
            self.session.autopilot.give_user_input(input, index), self.on_error
        )

    def on_refinement_input(self, input: str, index: int):
        create_async_task(
            self.session.autopilot.accept_refinement_input(input, index), self.on_error
        )

    def on_retry_at_index(self, index: int):
        create_async_task(self.session.autopilot.retry_at_index(index), self.on_error)

    def on_clear_history(self):
        create_async_task(self.session.autopilot.clear_history(), self.on_error)

    def on_delete_at_index(self, index: int):
        create_async_task(self.session.autopilot.delete_at_index(index), self.on_error)

    def edit_step_at_index(self, user_input: str, index: int):
        create_async_task(
            self.session.autopilot.edit_step_at_index(user_input, index),
            self.on_error,
        )

    def on_delete_context_with_ids(self, ids: List[str], index: Optional[int] = None):
        create_async_task(
            self.session.autopilot.delete_context_with_ids(ids, index), self.on_error
        )

    def on_toggle_adding_highlighted_code(self):
        create_async_task(
            self.session.autopilot.toggle_adding_highlighted_code(), self.on_error
        )
        posthog_logger.capture_event("toggle_adding_highlighted_code", {})

    def on_set_editing_at_ids(self, ids: List[str]):
        create_async_task(self.session.autopilot.set_editing_at_ids(ids), self.on_error)

    def on_show_logs_at_index(self, index: int):
        name = "Continue Prompt"
        logs = "\n\n############################################\n\n".join(
            ["This is the prompt that was sent to the LLM during this step"]
            + self.session.autopilot.continue_sdk.history.timeline[index].logs
        )
        create_async_task(
            self.session.autopilot.ide.showVirtualFile(name, logs), self.on_error
        )
        posthog_logger.capture_event("show_logs_at_index", {})

    def show_context_virtual_file(self, index: Optional[int] = None):
        async def async_stuff():
            if index is None:
                context_items = (
                    await self.session.autopilot.context_manager.get_selected_items()
                )
            elif index < len(self.session.autopilot.continue_sdk.history.timeline):
                context_items = self.session.autopilot.continue_sdk.history.timeline[
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

    def load_session(self, session_id: Optional[str] = None):
        async def load_and_tell_to_reconnect():
            new_session_id = await session_manager.load_session(
                self.session.session_id, session_id
            )
            await self._send_json(
                "reconnect_at_session", {"session_id": new_session_id}
            )

        create_async_task(load_and_tell_to_reconnect(), self.on_error)

        posthog_logger.capture_event("load_session", {"session_id": session_id})

    def set_current_session_title(self, title: str):
        self.session.autopilot.set_current_session_title(title)

    def set_system_message(self, message: str):
        self.session.autopilot.continue_sdk.config.system_message = message
        self.session.autopilot.continue_sdk.models.set_system_message(message)

        create_async_task(
            self.session.autopilot.set_config_attr(
                ["system_message"], create_string_node(message)
            ),
            self.on_error,
        )
        posthog_logger.capture_event("set_system_message", {"system_message": message})

    def set_temperature(self, temperature: float):
        self.session.autopilot.continue_sdk.config.temperature = temperature
        create_async_task(
            self.session.autopilot.set_config_attr(
                ["temperature"], create_float_node(temperature)
            ),
            self.on_error,
        )
        posthog_logger.capture_event("set_temperature", {"temperature": temperature})

    def set_model_for_role_from_index(self, role: str, index: int):
        async def async_stuff():
            models = self.session.autopilot.continue_sdk.config.models

            # Set models in SDK
            temp = models.default
            models.default = models.saved[index]
            models.saved[index] = temp
            await self.session.autopilot.continue_sdk.start_model(models.default)

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

            await self.session.autopilot.continue_sdk.update_ui()

        create_async_task(async_stuff(), self.on_error)

    def add_model_for_role(self, role: str, model_class: str, model: Any):
        models = self.session.autopilot.continue_sdk.config.models

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
                add_config_import(
                    f"from continuedev.libs.llm.{MODEL_MODULE_NAMES[model_class]} import {model_class}"
                )
                if "template_messages" in model:
                    add_config_import(
                        f"from continuedev.libs.llm.prompts.chat import {model['template_messages']}"
                    )

                # Set and start the new default model

                if "template_messages" in model:
                    model["template_messages"] = {
                        "llama2_template_messages": llama2_template_messages,
                        "template_alpaca_messages": template_alpaca_messages,
                    }[model["template_messages"]]
                new_model = MODEL_CLASSES[model_class](**model)
                models.default = new_model
                await self.session.autopilot.continue_sdk.start_model(models.default)

                # Construct and set the new models object
                JOINER = ",\n\t\t"
                saved_model_strings = set(
                    [display_llm_class(llm) for llm in saved_models]
                )
                models_args = {
                    "default": display_llm_class(models.default, True),
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
                await self.session.autopilot.continue_sdk.run_step(
                    SetupModelStep(model_class=model_class)
                )

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


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, session: Session = Depends(websocket_session)
):
    try:
        logger.debug(f"Received websocket connection at url: {websocket.url}")
        await websocket.accept()

        logger.debug("Session started")
        session_manager.register_websocket(session.session_id, websocket)
        protocol = GUIProtocolServer(session)
        protocol.websocket = websocket

        # Update any history that may have happened before connection
        await protocol.session.autopilot.update_subscribers()

        while AppStatus.should_exit is False:
            message = await websocket.receive_text()
            logger.debug(f"Received GUI message {message}")
            if isinstance(message, str):
                message = json.loads(message)

            if "messageType" not in message or "data" not in message:
                continue  # :o
            message_type = message["messageType"]
            data = message["data"]

            protocol.handle_json(message_type, data)
    except WebSocketDisconnect:
        logger.debug("GUI websocket disconnected")
    except Exception as e:
        # Log, send to PostHog, and send to GUI
        logger.debug(f"ERROR in gui websocket: {e}")
        err_msg = "\n".join(traceback.format_exception(e))
        posthog_logger.capture_event(
            "gui_error",
            {"error_title": e.__str__() or e.__repr__(), "error_message": err_msg},
        )

        await session.autopilot.ide.showMessage(err_msg)

        raise e
    finally:
        logger.debug("Closing gui websocket")
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close()

        await session_manager.persist_session(session.session_id)
        await session_manager.remove_session(session.session_id)
