from functools import cached_property
import traceback
import time
from typing import Any, Callable, Coroutine, Dict, List, Union
from aiohttp import ClientPayloadError
from pydantic import root_validator

from ..models.filesystem import RangeInFileWithContents
from ..models.filesystem_edit import FileEditWithFullContents
from .observation import Observation, InternalErrorObservation
from .context import ContextManager
from ..plugins.policies.default import DefaultPolicy
from ..plugins.context_providers.file import FileContextProvider
from ..plugins.context_providers.highlighted_code import HighlightedCodeContextProvider
from ..server.ide_protocol import AbstractIdeProtocolServer
from ..libs.util.queue import AsyncSubscriptionQueue
from ..models.main import ContinueBaseModel
from .main import Context, ContinueCustomException, Policy, History, FullState, Step, HistoryNode
from ..plugins.steps.core.core import DisplayErrorStep, ReversibleStep, ManualEditStep, UserInputStep
from .sdk import ContinueSDK
from ..libs.util.traceback_parsers import get_python_traceback, get_javascript_traceback
from openai import error as openai_errors
from ..libs.util.create_async_task import create_async_task
from ..libs.util.telemetry import posthog_logger
from ..libs.util.logging import logger


def get_error_title(e: Exception) -> str:
    if isinstance(e, openai_errors.APIError):
        return "OpenAI is overloaded with requests. Please try again."
    elif isinstance(e, openai_errors.RateLimitError):
        return "This OpenAI API key has been rate limited. Please try again."
    elif isinstance(e, openai_errors.Timeout):
        return "OpenAI timed out. Please try again."
    elif isinstance(e, openai_errors.InvalidRequestError) and e.code == "context_length_exceeded":
        return e._message
    elif isinstance(e, ClientPayloadError):
        return "The request to OpenAI failed. Please try again."
    elif isinstance(e, openai_errors.APIConnectionError):
        return "The request failed. Please check your internet connection and try again. If this issue persists, you can use our API key for free by going to VS Code settings and changing the value of continue.OPENAI_API_KEY to \"\""
    elif isinstance(e, openai_errors.InvalidRequestError):
        return 'Invalid request sent to OpenAI. Please try again.'
    elif "rate_limit_ip_middleware" in e.__str__():
        return 'You have reached your limit for free usage of our token. You can continue using Continue by entering your own OpenAI API key in VS Code settings.'
    elif e.__str__().startswith("Cannot connect to host"):
        return "The request failed. Please check your internet connection and try again."
    return e.__str__() or e.__repr__()


class Autopilot(ContinueBaseModel):
    ide: AbstractIdeProtocolServer

    policy: Policy = DefaultPolicy()
    history: History = History.from_empty()
    context: Context = Context()
    full_state: Union[FullState, None] = None
    context_manager: Union[ContextManager, None] = None
    continue_sdk: ContinueSDK = None

    _on_update_callbacks: List[Callable[[FullState], None]] = []

    _active: bool = False
    _should_halt: bool = False
    _main_user_input_queue: List[str] = []

    _user_input_queue = AsyncSubscriptionQueue()
    _retry_queue = AsyncSubscriptionQueue()

    async def start(self):
        self.continue_sdk = await ContinueSDK.create(self)
        if override_policy := self.continue_sdk.config.policy_override:
            self.policy = override_policy

        # Load documents into the search index
        self.context_manager = await ContextManager.create(
            self.continue_sdk.config.context_providers + [
                HighlightedCodeContextProvider(ide=self.ide),
                FileContextProvider(workspace_dir=self.ide.workspace_directory)
            ])
        await self.context_manager.load_index()

    class Config:
        arbitrary_types_allowed = True
        keep_untouched = (cached_property,)

    @root_validator(pre=True)
    def fill_in_values(cls, values):
        full_state: FullState = values.get('full_state')
        if full_state is not None:
            values['history'] = full_state.history
        return values

    async def get_full_state(self) -> FullState:
        full_state = FullState(
            history=self.history,
            active=self._active,
            user_input_queue=self._main_user_input_queue,
            default_model=self.continue_sdk.config.default_model,
            slash_commands=self.get_available_slash_commands(),
            adding_highlighted_code=self.context_manager.context_providers[
                "code"].adding_highlighted_code,
            selected_context_items=await self.context_manager.get_selected_items()
        )
        self.full_state = full_state
        return full_state

    def get_available_slash_commands(self) -> List[Dict]:
        custom_commands = list(map(lambda x: {
                               "name": x.name, "description": x.description}, self.continue_sdk.config.custom_commands)) or []
        slash_commands = list(map(lambda x: {
                              "name": x.name, "description": x.description}, self.continue_sdk.config.slash_commands)) or []
        return custom_commands + slash_commands

    async def clear_history(self):
        # Reset history
        self.history = History.from_empty()
        self._main_user_input_queue = []
        self._active = False

        # Clear context
        await self.context_manager.clear_context()

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
            # TODO: You're storing a lot of unecessary data here. Can compress into EditDiffs on the spot, and merge.
            # self._manual_edits_buffer = merge_file_edit(self._manual_edits_buffer, edit)
            # Note that this is being overriden to do nothing in DemoAgent

    async def handle_command_output(self, output: str):
        get_traceback_funcs = [get_python_traceback, get_javascript_traceback]
        for get_tb_func in get_traceback_funcs:
            traceback = get_tb_func(output)
            if traceback is not None:
                for tb_step in self.continue_sdk.config.on_traceback:
                    step = tb_step.step({"output": output, **tb_step.params})
                    await self._run_singular_step(step)

    async def handle_highlighted_code(self, range_in_files: List[RangeInFileWithContents]):
        # Add to context manager
        await self.context_manager.context_providers["code"].handle_highlighted_code(
            range_in_files)

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

    async def delete_context_with_ids(self, ids: List[str]):
        await self.context_manager.delete_context_with_ids(ids)
        await self.update_subscribers()

    async def toggle_adding_highlighted_code(self):
        self.context_manager.context_providers["code"].adding_highlighted_code = not self.context_manager.context_providers["code"].adding_highlighted_code
        await self.update_subscribers()

    async def set_editing_at_ids(self, ids: List[str]):
        self.context_manager.context_providers["code"].set_editing_at_ids(ids)
        await self.update_subscribers()

    async def _run_singular_step(self, step: "Step", is_future_step: bool = False) -> Coroutine[Observation, None, None]:
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
            'step run', {'step_name': step.name, 'params': step.dict()})

        if not is_future_step:
            # Check manual edits buffer, clear out if needed by creating a ManualEditStep
            if len(self._manual_edits_buffer) > 0:
                manualEditsStep = ManualEditStep.from_sequence(
                    self._manual_edits_buffer)
                self._manual_edits_buffer = []
                await self._run_singular_step(manualEditsStep)

        # Update history - do this first so we get top-first tree ordering
        index_of_history_node = self.history.add_node(HistoryNode(
            step=step, observation=None, depth=self._step_depth))

        # Call all subscribed callbacks
        await self.update_subscribers()

        # Try to run step and handle errors
        self._step_depth += 1

        caught_error = False
        try:
            observation = await step(self.continue_sdk)
        except Exception as e:
            if self.history.timeline[index_of_history_node].deleted:
                # If step was deleted/cancelled, don't show error or allow retry
                return None

            caught_error = True

            is_continue_custom_exception = issubclass(
                e.__class__, ContinueCustomException)

            error_string = e.message if is_continue_custom_exception else '\n'.join(
                traceback.format_exception(e))
            error_title = e.title if is_continue_custom_exception else get_error_title(
                e)

            # Attach an InternalErrorObservation to the step and unhide it.
            logger.error(
                f"Error while running step: \n{error_string}\n{error_title}")
            posthog_logger.capture_event('step error', {
                                         'error_message': error_string, 'error_title': error_title, 'step_name': step.name, 'params': step.dict()})

            observation = InternalErrorObservation(
                error=error_string, title=error_title)

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
        if not caught_error:
            self.history.timeline[index_of_history_node].observation = observation
            self.history.timeline[index_of_history_node].active = False
            await self.update_subscribers()

        # Update its description
        async def update_description():
            step.description = await step.describe(self.continue_sdk.models)
            # Update subscribers with new description
            await self.update_subscribers()

        create_async_task(update_description(
        ), on_error=lambda e: self.continue_sdk.run_step(DisplayErrorStep(e=e)))

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

        if len(self._main_user_input_queue) > 1:
            return

        # await self._request_halt()
        # Just run the step that takes user input, and
        # then up to the policy to decide how to deal with it.
        self._main_user_input_queue.pop(0)
        await self.update_subscribers()
        await self.run_from_step(UserInputStep(user_input=user_input))

        while len(self._main_user_input_queue) > 0:
            await self.run_from_step(UserInputStep(
                user_input=self._main_user_input_queue.pop(0)))

    async def accept_refinement_input(self, user_input: str, index: int):
        await self._request_halt()
        await self.reverse_to_index(index)
        await self.run_from_step(UserInputStep(user_input=user_input))

    async def select_context_item(self, id: str, query: str):
        await self.context_manager.select_context_item(id, query)
        await self.update_subscribers()
