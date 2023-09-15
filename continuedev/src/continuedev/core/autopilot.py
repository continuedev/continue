import json
import os
import time
import traceback
from functools import cached_property
from typing import Callable, Coroutine, Dict, List, Optional

import redbaron
from aiohttp import ClientPayloadError
from openai import error as openai_errors
from pydantic import root_validator

from ..libs.util.create_async_task import create_async_task
from ..libs.util.devdata import dev_data_logger
from ..libs.util.edit_config import edit_config_property
from ..libs.util.logging import logger
from ..libs.util.paths import getSavedContextGroupsPath
from ..libs.util.queue import AsyncSubscriptionQueue
from ..libs.util.strings import remove_quotes_and_escapes
from ..libs.util.telemetry import posthog_logger
from ..libs.util.traceback.traceback_parsers import (
    get_javascript_traceback,
    get_python_traceback,
)
from ..models.filesystem import RangeInFileWithContents
from ..models.filesystem_edit import FileEditWithFullContents
from ..models.main import ContinueBaseModel
from ..plugins.context_providers.file import FileContextProvider
from ..plugins.context_providers.highlighted_code import HighlightedCodeContextProvider
from ..plugins.policies.default import DefaultPolicy
from ..plugins.steps.core.core import (
    DisplayErrorStep,
    ManualEditStep,
    ReversibleStep,
    UserInputStep,
)
from ..plugins.steps.on_traceback import DefaultOnTracebackStep
from ..server.ide_protocol import AbstractIdeProtocolServer
from ..server.meilisearch_server import stop_meilisearch
from .config import ContinueConfig
from .context import ContextManager
from .main import (
    Context,
    ContextItem,
    ContinueCustomException,
    FullState,
    History,
    HistoryNode,
    Policy,
    SessionInfo,
    Step,
)
from .observation import InternalErrorObservation, Observation
from .sdk import ContinueSDK


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
        return "The request to OpenAI failed. Please try again."
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


class Autopilot(ContinueBaseModel):
    ide: AbstractIdeProtocolServer

    policy: Policy = DefaultPolicy()
    history: History = History.from_empty()
    context: Context = Context()
    full_state: Optional[FullState] = None
    session_info: Optional[SessionInfo] = None
    context_manager: ContextManager = ContextManager()
    continue_sdk: ContinueSDK = None

    _on_update_callbacks: List[Callable[[FullState], None]] = []

    _active: bool = False
    _should_halt: bool = False
    _main_user_input_queue: List[str] = []

    _user_input_queue = AsyncSubscriptionQueue()
    _retry_queue = AsyncSubscriptionQueue()

    started: bool = False

    async def start(
        self,
        full_state: Optional[FullState] = None,
        config: Optional[ContinueConfig] = None,
    ):
        self.continue_sdk = await ContinueSDK.create(self, config=config)
        if override_policy := self.continue_sdk.config.policy_override:
            self.policy = override_policy

        # Load documents into the search index
        logger.debug("Starting context manager")
        await self.context_manager.start(
            self.continue_sdk.config.context_providers
            + [
                HighlightedCodeContextProvider(ide=self.ide),
                FileContextProvider(workspace_dir=self.ide.workspace_directory),
            ],
            self.continue_sdk,
        )

        if full_state is not None:
            self.history = full_state.history
            self.session_info = full_state.session_info

        # Load saved context groups
        context_groups_file = getSavedContextGroupsPath()
        try:
            with open(context_groups_file, "r") as f:
                json_ob = json.load(f)
                for title, context_group in json_ob.items():
                    self._saved_context_groups[title] = [
                        ContextItem(**item) for item in context_group
                    ]
        except Exception as e:
            logger.warning(
                f"Failed to load saved_context_groups.json: {e}. Reverting to empty list."
            )
            self._saved_context_groups = {}

        self.started = True

    async def cleanup(self):
        if self.continue_sdk.lsp is not None:
            await self.continue_sdk.lsp.stop()
        stop_meilisearch()

    class Config:
        arbitrary_types_allowed = True
        keep_untouched = (cached_property,)

    @root_validator(pre=True)
    def fill_in_values(cls, values):
        full_state: FullState = values.get("full_state")
        if full_state is not None:
            values["history"] = full_state.history
        return values

    async def get_full_state(self) -> FullState:
        full_state = FullState(
            history=self.history,
            active=self._active,
            user_input_queue=self._main_user_input_queue,
            slash_commands=self.get_available_slash_commands(),
            adding_highlighted_code=self.context_manager.context_providers[
                "code"
            ].adding_highlighted_code
            if "code" in self.context_manager.context_providers
            else False,
            selected_context_items=await self.context_manager.get_selected_items()
            if self.context_manager is not None
            else [],
            session_info=self.session_info,
            config=self.continue_sdk.config,
            saved_context_groups=self._saved_context_groups,
            context_providers=self.context_manager.get_provider_descriptions(),
        )
        self.full_state = full_state
        return full_state

    def get_available_slash_commands(self) -> List[Dict]:
        custom_commands = (
            list(
                map(
                    lambda x: {"name": x.name, "description": x.description},
                    self.continue_sdk.config.custom_commands,
                )
            )
            or []
        )
        slash_commands = (
            list(
                map(
                    lambda x: {"name": x.name, "description": x.description},
                    self.continue_sdk.config.slash_commands,
                )
            )
            or []
        )
        return custom_commands + slash_commands

    async def clear_history(self):
        # Reset history
        self.history = History.from_empty()
        self._main_user_input_queue = []
        self._active = False

        # Clear context
        # await self.context_manager.clear_context()

        await self.update_subscribers()

    def on_update(self, callback: Coroutine["FullState", None, None]):
        """Subscribe to changes to state"""
        self._on_update_callbacks.append(callback)

    async def update_subscribers(self):
        full_state = await self.get_full_state()
        for callback in self._on_update_callbacks:
            await callback(full_state)

    def give_user_input(self, input: str, index: int):
        self._user_input_queue.post(str(index), input)

    async def wait_for_user_input(self) -> str:
        self._active = False
        await self.update_subscribers()
        user_input = await self._user_input_queue.get(str(self.history.current_index))
        self._active = True
        await self.update_subscribers()
        return user_input

    _manual_edits_buffer: List[FileEditWithFullContents] = []

    async def reverse_to_index(self, index: int):
        try:
            while self.history.get_current_index() >= index:
                current_step = self.history.get_current().step
                self.history.step_back()
                if issubclass(current_step.__class__, ReversibleStep):
                    await current_step.reverse(self.continue_sdk)

                await self.update_subscribers()
        except Exception as e:
            logger.debug(e)

    def handle_manual_edits(self, edits: List[FileEditWithFullContents]):
        for edit in edits:
            self._manual_edits_buffer.append(edit)
            # TODO: You're storing a lot of unnecessary data here. Can compress into EditDiffs on the spot, and merge.
            # self._manual_edits_buffer = merge_file_edit(self._manual_edits_buffer, edit)
            # Note that this is being overridden to do nothing in DemoAgent

    async def handle_command_output(self, output: str):
        get_traceback_funcs = [get_python_traceback, get_javascript_traceback]
        for get_tb_func in get_traceback_funcs:
            traceback = get_tb_func(output)
            if (
                traceback is not None
                and self.continue_sdk.config.on_traceback is not None
            ):
                step = self.continue_sdk.config.on_traceback(output=output)
                await self._run_singular_step(step)

    async def handle_debug_terminal(self, content: str):
        """Run the debug terminal step"""
        # step = self.continue_sdk.config.on_traceback(output=content)
        step = DefaultOnTracebackStep(output=content)
        await self._run_singular_step(step)

    async def handle_highlighted_code(
        self, range_in_files: List[RangeInFileWithContents]
    ):
        if "code" not in self.context_manager.context_providers:
            return

        # Add to context manager
        await self.context_manager.context_providers["code"].handle_highlighted_code(
            range_in_files
        )

        await self.update_subscribers()

    _step_depth: int = 0

    async def retry_at_index(self, index: int):
        self.history.timeline[index].step.hide = True
        self._retry_queue.post(str(index), None)

    async def delete_at_index(self, index: int):
        self.history.timeline[index].step.hide = True
        self.history.timeline[index].deleted = True
        self.history.timeline[index].active = False

        await self.update_subscribers()

    async def edit_step_at_index(self, user_input: str, index: int):
        step_to_rerun = self.history.timeline[index].step.copy()
        step_to_rerun.user_input = user_input
        step_to_rerun.description = user_input

        # Halt the agent's currently running jobs (delete them)
        while len(self.history.timeline) > index:
            # Remove from timeline
            node_to_delete = self.history.timeline.pop()
            # Delete so it is stopped if in the middle of running
            node_to_delete.deleted = True

        self.history.current_index = index - 1
        await self.update_subscribers()

        # Rerun from the current step
        await self.run_from_step(step_to_rerun)

    async def delete_context_with_ids(self, ids: List[str]):
        await self.context_manager.delete_context_with_ids(ids)
        await self.update_subscribers()

    async def toggle_adding_highlighted_code(self):
        if "code" not in self.context_manager.context_providers:
            return

        self.context_manager.context_providers[
            "code"
        ].adding_highlighted_code = not self.context_manager.context_providers[
            "code"
        ].adding_highlighted_code
        await self.update_subscribers()

    async def set_editing_at_ids(self, ids: List[str]):
        if "code" not in self.context_manager.context_providers:
            return

        await self.context_manager.context_providers["code"].set_editing_at_ids(ids)
        await self.update_subscribers()

    async def _run_singular_step(
        self, step: "Step", is_future_step: bool = False
    ) -> Coroutine[Observation, None, None]:
        # Allow config to set disallowed steps
        if step.__class__.__name__ in self.continue_sdk.config.disallowed_steps:
            return None

        # If a parent step is deleted/cancelled, don't run this step
        # TODO: This was problematic because when running a step after deleting one, it seemed to think that was the parent
        # last_depth = self._step_depth
        # i = self.history.current_index
        # while i >= 0 and self.history.timeline[i].depth == last_depth - 1:
        #     if self.history.timeline[i].deleted:
        #         return None
        #     last_depth = self.history.timeline[i].depth
        #     i -= 1

        posthog_logger.capture_event(
            "step run", {"step_name": step.name, "params": step.dict()}
        )
        dev_data_logger.capture(
            "step_run", {"step_name": step.name, "params": step.dict()}
        )

        if not is_future_step:
            # Check manual edits buffer, clear out if needed by creating a ManualEditStep
            if len(self._manual_edits_buffer) > 0:
                manualEditsStep = ManualEditStep.from_sequence(
                    self._manual_edits_buffer
                )
                self._manual_edits_buffer = []
                await self._run_singular_step(manualEditsStep)

        # Update history - do this first so we get top-first tree ordering
        index_of_history_node = self.history.add_node(
            HistoryNode(step=step, observation=None, depth=self._step_depth)
        )

        # Call all subscribed callbacks
        await self.update_subscribers()

        # Try to run step and handle errors
        self._step_depth += 1

        caught_error = False
        try:
            observation = await step(self.continue_sdk)
        except Exception as e:
            if (
                index_of_history_node >= len(self.history.timeline)
                or self.history.timeline[index_of_history_node].deleted
            ):
                # If step was deleted/cancelled, don't show error or allow retry
                return None

            caught_error = True

            is_continue_custom_exception = issubclass(
                e.__class__, ContinueCustomException
            )

            error_string = (
                e.message
                if is_continue_custom_exception
                else "\n".join(traceback.format_exception(e))
            )
            error_title = (
                e.title if is_continue_custom_exception else get_error_title(e)
            )

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

            observation = InternalErrorObservation(
                error=error_string, title=error_title
            )

            # Reveal this step, but hide all of the following steps (its substeps)
            step_was_hidden = step.hide

            step.hide = False
            i = self.history.get_current_index()
            while self.history.timeline[i].step.name != step.name:
                self.history.timeline[i].step.hide = True
                i -= 1

            # i is now the index of the step that we want to show/rerun
            self.history.timeline[i].observation = observation
            self.history.timeline[i].active = False

            await self.update_subscribers()

            # ContinueCustomException can optionally specify a step to run on the error
            if is_continue_custom_exception and e.with_step is not None:
                await self._run_singular_step(e.with_step)

            # Wait for a retry signal and then resume the step
            self._active = False
            await self._retry_queue.get(str(i))
            self._active = True
            # You might consider a "ignore and continue" button
            # want it to have same step depth, so have to decrement
            self._step_depth -= 1
            copy_step = step.copy()
            copy_step.hide = step_was_hidden
            observation = await self._run_singular_step(copy_step)
            self._step_depth += 1

        self._step_depth -= 1

        # Add observation to history, unless already attached error observation
        if not caught_error and index_of_history_node < len(self.history.timeline):
            self.history.timeline[index_of_history_node].observation = observation
            self.history.timeline[index_of_history_node].active = False
            await self.update_subscribers()

        # Update its description
        async def update_description():
            if self.continue_sdk.config.disable_summaries:
                return

            description = await step.describe(self.continue_sdk.models)
            if description is not None:
                step.description = description
            # Update subscribers with new description
            await self.update_subscribers()

        create_async_task(
            update_description(),
            on_error=lambda e: self.continue_sdk.run_step(DisplayErrorStep(e=e)),
        )

        return observation

    async def run_from_step(self, step: "Step"):
        # if self._active:
        #     raise RuntimeError("Autopilot is already running")
        self._active = True

        next_step = step
        is_future_step = False
        while not (next_step is None or self._should_halt):
            if is_future_step:
                # If future step, then we are replaying and need to delete the step from history so it can be replaced
                self.history.remove_current_and_substeps()

            await self._run_singular_step(next_step, is_future_step)

            if next_step := self.policy.next(self.continue_sdk.config, self.history):
                is_future_step = False
            elif next_step := self.history.take_next_step():
                is_future_step = True
            else:
                next_step = None

        self._active = False

        # Doing this so active can make it to the frontend after steps are done. But want better state syncing tools
        await self.update_subscribers()

    async def run_from_observation(self, observation: Observation):
        next_step = self.policy.next(self.continue_sdk.config, self.history)
        await self.run_from_step(next_step)

    async def run_policy(self):
        first_step = self.policy.next(self.continue_sdk.config, self.history)
        await self.run_from_step(first_step)

    async def _request_halt(self):
        if self._active:
            self._should_halt = True
            while self._active:
                time.sleep(0.1)
        self._should_halt = False
        return None

    async def accept_user_input(self, user_input: str):
        self._main_user_input_queue.append(user_input)
        await self.update_subscribers()

        # Use the first input to create title for session info, and make the session saveable
        if self.session_info is None:

            async def create_title():
                if (
                    self.session_info is not None
                    and self.session_info.title is not None
                ):
                    return

                if self.continue_sdk.config.disable_summaries:
                    title = user_input
                else:
                    title = await self.continue_sdk.models.medium.complete(
                        f'Give a short title to describe the current chat session. Do not put quotes around the title. The first message was: "{user_input}". Do not use more than 10 words. The title is: ',
                        max_tokens=20,
                    )
                    title = remove_quotes_and_escapes(title)

                self.session_info = SessionInfo(
                    title=title,
                    session_id=self.ide.session_id,
                    date_created=str(time.time()),
                    workspace_directory=self.ide.workspace_directory,
                )
                dev_data_logger.capture("new_session", self.session_info.dict())

            create_async_task(
                create_title(),
                on_error=lambda e: self.continue_sdk.run_step(DisplayErrorStep(e=e)),
            )

        if len(self._main_user_input_queue) > 1:
            return

        # await self._request_halt()
        # Just run the step that takes user input, and
        # then up to the policy to decide how to deal with it.
        self._main_user_input_queue.pop(0)
        await self.update_subscribers()
        await self.run_from_step(UserInputStep(user_input=user_input))

        while len(self._main_user_input_queue) > 0:
            await self.run_from_step(
                UserInputStep(user_input=self._main_user_input_queue.pop(0))
            )

    async def accept_refinement_input(self, user_input: str, index: int):
        await self._request_halt()
        await self.reverse_to_index(index)
        await self.run_from_step(UserInputStep(user_input=user_input))

    async def select_context_item(self, id: str, query: str):
        await self.context_manager.select_context_item(id, query)
        await self.update_subscribers()

    async def set_config_attr(self, key_path: List[str], value: redbaron.RedBaron):
        edit_config_property(key_path, value)
        await self.update_subscribers()

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

    async def select_context_group(self, id: str):
        if id not in self._saved_context_groups:
            logger.warning(f"Context group {id} not found")
            return
        context_group = self._saved_context_groups[id]
        await self.context_manager.clear_context()
        for item in context_group:
            await self.context_manager.manually_add_context_item(item)
        await self.update_subscribers()

        posthog_logger.capture_event(
            "select_context_group", {"title": id, "length": len(context_group)}
        )
        dev_data_logger.capture(
            "select_context_group", {"title": id, "items": context_group}
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
