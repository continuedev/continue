from functools import cached_property
import traceback
import time
from typing import Any, Callable, Coroutine, Dict, List
import os
from aiohttp import ClientPayloadError

from ..models.filesystem import RangeInFileWithContents
from ..models.filesystem_edit import FileEditWithFullContents
from ..libs.llm import LLM
from .observation import Observation, InternalErrorObservation
from ..server.ide_protocol import AbstractIdeProtocolServer
from ..libs.util.queue import AsyncSubscriptionQueue
from ..models.main import ContinueBaseModel
from .main import Context, ContinueCustomException, HighlightedRangeContext, Policy, History, FullState, Step, HistoryNode
from ..steps.core.core import ReversibleStep, ManualEditStep, UserInputStep
from ..libs.util.telemetry import capture_event
from .sdk import ContinueSDK
import asyncio
from ..libs.util.step_name_to_steps import get_step_from_name
from ..libs.util.traceback_parsers import get_python_traceback, get_javascript_traceback
from openai import error as openai_errors
from ..libs.util.create_async_task import create_async_task


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
        return "The request failed. Please check your internet connection and try again."
    elif isinstance(e, openai_errors.InvalidRequestError):
        return 'Your API key does not have access to GPT-4. You can use ours for free by going to VS Code settings and changing the value of continue.OPENAI_API_KEY to ""'
    return e.__str__() or e.__repr__()


class Autopilot(ContinueBaseModel):
    policy: Policy
    ide: AbstractIdeProtocolServer
    history: History = History.from_empty()
    context: Context = Context()
    _on_update_callbacks: List[Callable[[FullState], None]] = []

    _active: bool = False
    _should_halt: bool = False
    _main_user_input_queue: List[str] = []

    _user_input_queue = AsyncSubscriptionQueue()
    _retry_queue = AsyncSubscriptionQueue()

    @cached_property
    def continue_sdk(self) -> ContinueSDK:
        return ContinueSDK(self)

    class Config:
        arbitrary_types_allowed = True
        keep_untouched = (cached_property,)

    def get_full_state(self) -> FullState:
        return FullState(
            history=self.history,
            active=self._active,
            user_input_queue=self._main_user_input_queue,
            default_model=self.continue_sdk.config.default_model,
            highlighted_ranges=self._highlighted_ranges,
            slash_commands=self.get_available_slash_commands(),
            adding_highlighted_code=self._adding_highlighted_code,
        )

    def get_available_slash_commands(self) -> List[Dict]:
        custom_commands = list(map(lambda x: {
                               "name": x.name, "description": x.description}, self.continue_sdk.config.custom_commands)) or []
        slash_commands = list(map(lambda x: {
                              "name": x.name, "description": x.description}, self.continue_sdk.config.slash_commands)) or []
        return custom_commands + slash_commands

    async def change_default_model(self, model: str):
        self.continue_sdk.update_default_model(model)

    async def clear_history(self):
        self.history = History.from_empty()
        self._main_user_input_queue = []
        self._active = False
        await self.update_subscribers()

    def on_update(self, callback: Coroutine["FullState", None, None]):
        """Subscribe to changes to state"""
        self._on_update_callbacks.append(callback)

    async def update_subscribers(self):
        full_state = self.get_full_state()
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
            print(e)

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
                    step = get_step_from_name(
                        tb_step.step_name, {"output": output, **tb_step.params})
                    await self._run_singular_step(step)

    _highlighted_ranges: List[HighlightedRangeContext] = []
    _adding_highlighted_code: bool = False

    def _make_sure_is_editing_range(self):
        """If none of the highlighted ranges are currently being edited, the first should be selected"""
        if len(self._highlighted_ranges) == 0:
            return
        if not any(map(lambda x: x.editing, self._highlighted_ranges)):
            self._highlighted_ranges[0].editing = True

    async def handle_highlighted_code(self, range_in_files: List[RangeInFileWithContents]):
        # Filter out rifs from ~/.continue/diffs folder
        range_in_files = [
            rif for rif in range_in_files if not os.path.dirname(rif.filepath) == os.path.expanduser("~/.continue/diffs")]

        # Make sure all filepaths are relative to workspace
        workspace_path = self.continue_sdk.ide.workspace_directory

        # If not adding highlighted code
        if not self._adding_highlighted_code:
            if len(self._highlighted_ranges) == 1 and len(range_in_files) <= 1 and (len(range_in_files) == 0 or range_in_files[0].range.start == range_in_files[0].range.end):
                # If un-highlighting the range to edit, then remove the range
                self._highlighted_ranges = []
                await self.update_subscribers()
            elif len(range_in_files) > 0:
                # Otherwise, replace the current range with the new one
                # This is the first range to be highlighted
                self._highlighted_ranges = [HighlightedRangeContext(
                    range=range_in_files[0], editing=True, pinned=False, display_name=os.path.basename(range_in_files[0].filepath))]
                await self.update_subscribers()
            return

        # If current range overlaps with any others, delete them and only keep the new range
        new_ranges = []
        for i, rif in enumerate(self._highlighted_ranges):
            found_overlap = False
            for new_rif in range_in_files:
                if rif.range.filepath == new_rif.filepath and rif.range.range.overlaps_with(new_rif.range):
                    found_overlap = True
                    break

                # Also don't allow multiple ranges in same file with same content. This is useless to the model, and avoids
                # the bug where cmd+f causes repeated highlights
                if rif.range.filepath == new_rif.filepath and rif.range.contents == new_rif.contents:
                    found_overlap = True
                    break

            if not found_overlap:
                new_ranges.append(rif)

        self._highlighted_ranges = new_ranges + [HighlightedRangeContext(
            range=rif, editing=False, pinned=False, display_name=os.path.basename(rif.filepath)
        ) for rif in range_in_files]

        self._make_sure_is_editing_range()

        await self.update_subscribers()

    _step_depth: int = 0

    async def retry_at_index(self, index: int):
        self.history.timeline[index].step.hide = True
        self._retry_queue.post(str(index), None)

    async def delete_at_index(self, index: int):
        self.history.timeline[index].step.hide = True
        self.history.timeline[index].deleted = True
        await self.update_subscribers()

    async def delete_context_at_indices(self, indices: List[int]):
        kept_ranges = []
        for i, rif in enumerate(self._highlighted_ranges):
            if i not in indices:
                kept_ranges.append(rif)
        self._highlighted_ranges = kept_ranges

        self._make_sure_is_editing_range()

        await self.update_subscribers()

    async def toggle_adding_highlighted_code(self):
        self._adding_highlighted_code = not self._adding_highlighted_code
        await self.update_subscribers()

    async def set_editing_at_indices(self, indices: List[int]):
        for i in range(len(self._highlighted_ranges)):
            self._highlighted_ranges[i].editing = i in indices
        await self.update_subscribers()

    async def set_pinned_at_indices(self, indices: List[int]):
        for i in range(len(self._highlighted_ranges)):
            self._highlighted_ranges[i].pinned = i in indices
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

        capture_event(self.continue_sdk.ide.unique_id, 'step run', {
                      'step_name': step.name, 'params': step.dict()})

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
                traceback.format_tb(e.__traceback__)) + f"\n\n{e.__repr__()}"
            error_title = e.title if is_continue_custom_exception else get_error_title(
                e)

            # Attach an InternalErrorObservation to the step and unhide it.
            print(f"Error while running step: \n{error_string}\n{error_title}")
            capture_event(self.continue_sdk.ide.unique_id, 'step error', {
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

        create_async_task(update_description(),
                          self.continue_sdk.ide.unique_id)

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

        # Remove context unless pinned
        # self._highlighted_ranges = [
        #     hr for hr in self._highlighted_ranges if hr.pinned]

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
