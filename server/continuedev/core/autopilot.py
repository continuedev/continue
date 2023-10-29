import json
import os
import traceback
import uuid
from typing import Dict, List, Optional

import redbaron
from aiohttp import ClientPayloadError
from openai import error as openai_errors

from ..libs.util.devdata import dev_data_logger
from ..libs.util.edit_config import edit_config_property
from ..libs.util.logging import logger
from ..libs.util.paths import getSavedContextGroupsPath
from ..libs.util.telemetry import posthog_logger
from ..libs.util.traceback.traceback_parsers import (
    get_javascript_traceback,
    get_python_traceback,
)
from ..models.filesystem import RangeInFileWithContents
from ..server.protocols.gui_protocol import AbstractGUIProtocolServer
from ..server.protocols.ide_protocol import AbstractIdeProtocolServer
from ..plugins.policies.default import DefaultPolicy
from ..plugins.steps.on_traceback import DefaultOnTracebackStep

from .config import ContinueConfig
from .main import (
    AutopilotGenerator,
    AutopilotGeneratorOutput,
    Context,
    ContextItem,
    ContinueCustomException,
    ContinueError,
    Policy,
    SessionState,
    SetStep,
    Step,
    UpdateStep,
    SessionUpdate,
    StepDescription,
    DeltaStep,
)
from .observation import Observation
from .sdk import ContinueSDK
from .steps import UserInputStep


def get_error_title(e: Exception) -> str:
    if isinstance(e, openai_errors.APIError):
        return "OpenAI is overloaded with requests. Please try again."
    elif isinstance(e, openai_errors.RateLimitError):
        return "This OpenAI API key has been rate limited. Please try again."
    elif isinstance(e, openai_errors.Timeout):
        return "OpenAI timed out. Please try again."
    elif (
        isinstance(e, openai_errors.InvalidRequestError)
        and e.code == "context_length_exceeded"
    ):
        return e._message
    elif isinstance(e, ClientPayloadError):
        return "The request failed. Please try again."
    elif isinstance(e, openai_errors.APIConnectionError):
        return 'The request failed. Please check your internet connection and try again. If this issue persists, you can use our API key for free by going to VS Code settings and changing the value of continue.OPENAI_API_KEY to ""'
    elif isinstance(e, openai_errors.InvalidRequestError):
        return "Invalid request sent to OpenAI. Please try again."
    elif "rate_limit_ip_middleware" in e.__str__():
        return "You have reached your limit for free usage of our token. You can continue using Continue by entering your own OpenAI API key in VS Code settings."
    elif e.__str__().startswith("Cannot connect to host"):
        return (
            "The request failed. Please check your internet connection and try again."
        )
    return e.__str__() or e.__repr__()


class Autopilot:
    session_state: SessionState
    ide: AbstractIdeProtocolServer
    gui: AbstractGUIProtocolServer
    config: ContinueConfig

    context: Context = Context()
    # context_manager: ContextManager = ContextManager()

    def __init__(
        self,
        session_state: SessionState,
        ide: AbstractIdeProtocolServer,
        gui: AbstractGUIProtocolServer,
        config: ContinueConfig,
    ):
        self.session_state = session_state
        self.ide = ide
        self.gui = gui
        self.config = config

    @property
    def policy(self) -> Policy:
        return self.config.policy_override or DefaultPolicy()

    @property
    def sdk(self) -> ContinueSDK:
        return ContinueSDK(self.config, self.ide, self.gui, self)

    class Config:
        arbitrary_types_allowed = True

    def get_available_slash_commands(self) -> List[Dict]:
        custom_commands = (
            list(
                map(
                    lambda x: {"name": x.name, "description": x.description},
                    self.sdk.config.custom_commands,
                )
            )
            or []
        )
        slash_commands = (
            list(
                map(
                    lambda x: {"name": x.name, "description": x.description},
                    self.sdk.config.slash_commands,
                )
            )
            or []
        )
        cmds = custom_commands + slash_commands
        cmds.sort(key=lambda x: x["name"] == "edit", reverse=True)
        return cmds

    async def wait_for_user_input(self) -> str:
        # Goes to sdk.gui
        self._active = False
        await self.update_subscribers()
        user_input = await self._user_input_queue.get(str(self.history.current_index))
        self._active = True
        await self.update_subscribers()
        return user_input

    async def handle_command_output(self, output: str):
        # Goes to window?
        # Should server keep the latest state as a copy, or does the IDE need to ask the GUI?
        get_traceback_funcs = [get_python_traceback, get_javascript_traceback]
        for get_tb_func in get_traceback_funcs:
            traceback = get_tb_func(output)
            if traceback is not None and self.sdk.config.on_traceback is not None:
                step = self.sdk.config.on_traceback(output=output)
                await self.run_step(step)

    async def handle_debug_terminal(self, content: str):
        """Run the debug terminal step"""
        # Same as above
        # step = self.continue_sdk.config.on_traceback(output=content)
        step = DefaultOnTracebackStep(output=content)
        await self.run_step(step)

    async def handle_highlighted_code(
        self,
        range_in_files: List[RangeInFileWithContents],
        edit: Optional[bool] = False,
    ):
        # Same as above
        if "code" not in self.context_manager.context_providers:
            return

        # Add to context manager
        await self.context_manager.context_providers["code"].handle_highlighted_code(
            range_in_files, edit
        )

        await self.update_subscribers()

    def handle_error(self, e: Exception, step: Step) -> ContinueCustomException:
        is_continue_custom_exception = (
            issubclass(e.__class__, ContinueCustomException)
            or e.__class__.__name__ == ContinueCustomException.__name__
        )

        error_string = (
            e.message
            if is_continue_custom_exception
            else "\n".join(traceback.format_exception(e, e, e.__traceback__))
        )
        error_title = e.title if is_continue_custom_exception else get_error_title(e)

        # Attach an InternalErrorObservation to the step and unhide it.
        logger.error(f"Error while running step: \n{error_string}\n{error_title}")
        posthog_logger.capture_event(
            "step error",
            {
                "error_message": error_string,
                "error_title": error_title,
                "step_name": step.name,
                "params": step.dict(),
            },
        )

        if is_continue_custom_exception:
            return e
        else:
            return ContinueCustomException(title=error_title, message=error_string)

    def log_step(self, step: Step, context_used: List[ContextItem]):
        posthog_logger.capture_event(
            "step run",
            {
                "step_name": step.name,
                "params": step.dict(),
                "context": list(
                    map(
                        lambda item: item.dict(),
                        context_used,
                    )
                ),
            },
        )
        step_id = uuid.uuid4().hex
        dev_data_logger.capture(
            "step_run",
            {"step_name": step.name, "params": step.dict(), "step_id": step_id},
        )
        dev_data_logger.capture(
            "context_used",
            {
                "context": list(
                    map(
                        lambda item: item.dict(),
                        context_used,
                    )
                ),
                "step_id": step_id,
            },
        )

    _step_depth: int = 0
    stopped = False

    async def _run_singular_step(self, step: "Step") -> AutopilotGenerator:
        # Allow config to set disallowed steps
        if step.__class__.__name__ in self.sdk.config.disallowed_steps:
            return

        # Log the context and step to dev data
        context_used = self.session_state.context_items
        self.log_step(step, context_used)

        # Update history - do this first so we get top-first tree ordering
        self._step_depth += 1
        index = len(self.session_state.history)
        yield StepDescription(
            step_type=step.__class__.__name__,
            name=step.name,
            description=step.description,
            params=step.dict(),
            hide=step.hide,
            depth=self._step_depth,
        )

        # Try to run step and handle errors
        try:
            async for update in step.run(self.sdk):
                if self.stopped:
                    # TODO: Early stopping
                    return

                if isinstance(update, str):
                    yield SessionUpdate(
                        index=index, update=DeltaStep(description=update)
                    )
                elif isinstance(update, Observation):
                    yield SessionUpdate(
                        index=index, update=DeltaStep(observations=[update])
                    )
                elif isinstance(update, DeltaStep) or isinstance(update, SetStep):
                    yield SessionUpdate(index=index, update=update)
                else:
                    logger.warning(f"Unknown type yielded from Step: {update}")
        except Exception as e:
            continue_custom_exception = self.handle_error(e, step)

            yield SessionUpdate(index=index, update=DeltaStep(hide=False))
            while self.session_state.history[index].name != step.name:
                yield SessionUpdate(index=index, update=DeltaStep(hide=True))
                index -= 1

            # i is now the index of the step that we want to show/rerun
            yield SessionUpdate(
                index=index,
                update=DeltaStep(
                    error=ContinueError(
                        title=continue_custom_exception.title,
                        message=continue_custom_exception.message,
                    )
                ),
            )

            # ContinueCustomException can optionally specify a step to run on the error
            if after_err_step := continue_custom_exception.with_step:
                await self.run_step(after_err_step)

        self._step_depth -= 1

        # NOTE: index here doesn't matter, awkward
        yield SessionUpdate(index=index, stop=True, update=DeltaStep())

        # # Update its description
        # async def update_description():
        #     if (
        #         self.continue_sdk.config.disable_summaries
        #         or self.history.timeline[index_of_history_node].deleted
        #     ):
        #         return

        #     description = await step.describe(self.continue_sdk.models)
        #     if description is not None:
        #         step.description = description
        #     # Update subscribers with new description
        #     await self.update_subscribers()

        # create_async_task(
        #     update_description(),
        #     on_error=lambda e: self.continue_sdk.run_step(
        #         DisplayErrorStep.from_exception(e)
        #     ),
        # )

        # Create the session title if not done yet
        # if (
        #     self.session_info is None or self.session_info.title is None
        # ) and not self.history.timeline[index_of_history_node].deleted:
        #     visible_nodes = list(
        #         filter(lambda node: not node.step.hide, self.history.timeline)
        #     )

        #     user_input = None
        #     should_create_title = False
        #     for visible_node in visible_nodes:
        #         if isinstance(visible_node.step, UserInputStep):
        #             if user_input is None:
        #                 user_input = visible_node.step.user_input
        #             else:
        #                 # More than one user input, so don't create title
        #                 should_create_title = False
        #                 break
        #         elif user_input is None:
        #             continue
        #         else:
        #             # Already have user input, now have the next step
        #             should_create_title = True
        #             break

        #     # Only create the title if the step after the first input is done
        #     if should_create_title:
        #         create_async_task(
        #             self.create_title(backup=user_input),
        #             on_error=lambda e: self.continue_sdk.run_step(
        #                 DisplayErrorStep.from_exception(e)
        #             ),
        #         )

    async def run_step(self, step: Step):
        async for update in self._run_singular_step(step):
            await self.handle_session_update(update)

    async def handle_session_update(self, update: AutopilotGeneratorOutput):
        if isinstance(update, StepDescription):
            index = len(self.session_state.history)
            self.session_state.history.append(update)
            set_step = SetStep(**update.dict())
            await self.sdk.gui.send_session_update(
                SessionUpdate(index=index, update=set_step)
            )
            return

        if update.index > len(self.session_state.history):
            raise Exception(
                f"History update index {update.index} is greater than history length {len(self.session_state.history)}"
            )
        elif update.index == len(self.session_state.history):
            raise Exception(
                f"History update index {update.index} is equal to history length {len(self.session_state.history)}. Must yield a StepDescription to add a new step."
            )

        self.session_state.history[update.index].update(update.update)
        await self.sdk.gui.send_session_update(update)

    async def run(self):
        async def add_log(log: str):
            await self.handle_session_update(
                SessionUpdate(
                    index=len(self.session_state.history) - 1,
                    update=DeltaStep(logs=[log]),
                )
            )

        logger_id = self.config.models.add_logger(add_log)
        while next_step := self.policy.next(self.sdk.config, self.session_state):
            await self.run_step(next_step)

        self.config.models.remove_logger(logger_id)

    # async def create_title(self, backup: str = None):
    #     # Want sdk.gui.update_title(title)
    #     # Use the first input and first response to create title for session info, and make the session saveable
    #     if self.session_info is not None and self.session_info.title is not None:
    #         return

    #     if self.continue_sdk.config.disable_summaries:
    #         if backup is not None:
    #             title = backup
    #         else:
    #             title = "New Session"
    #     else:
    #         chat_history = list(
    #             map(lambda x: x.dict(), await self.continue_sdk.get_chat_context())
    #         )
    #         chat_history_str = template_alpaca_messages(chat_history)
    #         title = await self.continue_sdk.models.summarize.complete(
    #             f"{chat_history_str}\n\nGive a short title to describe the above chat session. Do not put quotes around the title. Do not use more than 6 words. The title is: ",
    #             max_tokens=20,
    #             log=False,
    #         )
    #         title = remove_quotes_and_escapes(title)

    #     self.set_current_session_title(title)
    #     await self.update_subscribers()
    #     dev_data_logger.capture("new_session", self.session_info.dict())

    async def reject_diff(self, step_index: int):
        # idk...
        # Hide the edit step and the UserInputStep before it
        self.history.timeline[step_index].step.hide = True
        for i in range(step_index - 1, -1, -1):
            if isinstance(self.history.timeline[i].step, UserInputStep):
                self.history.timeline[i].step.hide = True
                break
        await self.update_subscribers()

    async def select_context_item(self, id: str, query: str):
        # sdk.gui.select_context_item???
        await self.context_manager.select_context_item(id, query)
        await self.update_subscribers()

    async def set_config_attr(self, key_path: List[str], value: redbaron.RedBaron):
        # Bruh
        edit_config_property(key_path, value)
        await self.update_subscribers()

    # region Context Groups

    _saved_context_groups: Dict[str, List[ContextItem]] = {}

    def _persist_context_groups(self):
        context_groups_file = getSavedContextGroupsPath()
        if os.path.exists(context_groups_file):
            with open(context_groups_file, "w") as f:
                dict_to_save = {
                    title: [item.dict() for item in context_items]
                    for title, context_items in self._saved_context_groups.items()
                }
                json.dump(dict_to_save, f)

    async def save_context_group(self, title: str, context_items: List[ContextItem]):
        self._saved_context_groups[title] = context_items
        await self.update_subscribers()

        # Update saved context groups
        self._persist_context_groups()

        posthog_logger.capture_event(
            "save_context_group", {"title": title, "length": len(context_items)}
        )

    async def delete_context_group(self, id: str):
        if id not in self._saved_context_groups:
            logger.warning(f"Context group {id} not found")
            return
        del self._saved_context_groups[id]
        await self.update_subscribers()

        # Update saved context groups
        self._persist_context_groups()

        posthog_logger.capture_event("delete_context_group", {"title": id})

    # endregion
