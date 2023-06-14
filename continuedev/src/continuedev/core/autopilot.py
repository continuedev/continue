from functools import cached_property
import traceback
import time
from typing import Any, Callable, Coroutine, Dict, List
from ..models.filesystem_edit import FileEditWithFullContents
from ..libs.llm import LLM
from .observation import Observation, InternalErrorObservation
from ..server.ide_protocol import AbstractIdeProtocolServer
from ..libs.util.queue import AsyncSubscriptionQueue
from ..models.main import ContinueBaseModel
from .main import Context, ContinueCustomException, Policy, History, FullState, Step, HistoryNode
from ..steps.core.core import ReversibleStep, ManualEditStep, UserInputStep
from ..libs.util.telemetry import capture_event
from .sdk import ContinueSDK
import asyncio


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
        return FullState(history=self.history, active=self._active, user_input_queue=self._main_user_input_queue)

    async def get_available_slash_commands(self) -> List[Dict]:
        return list(map(lambda x: {"name": x.name, "description": x.description}, self.continue_sdk.config.slash_commands)) or []

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

    def handle_traceback(self, traceback: str):
        raise NotImplementedError

    _step_depth: int = 0

    async def retry_at_index(self, index: int):
        self._retry_queue.post(str(index), None)

    async def delete_at_index(self, index: int):
        self.history.timeline[index].step.hide = True
        await self.update_subscribers()

    async def _run_singular_step(self, step: "Step", is_future_step: bool = False) -> Coroutine[Observation, None, None]:
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
        self.history.add_node(HistoryNode(
            step=step, observation=None, depth=self._step_depth))

        # Call all subscribed callbacks
        await self.update_subscribers()

        # Try to run step and handle errors
        self._step_depth += 1

        caught_error = False
        try:
            observation = await step(self.continue_sdk)
        except Exception as e:
            caught_error = True

            is_continue_custom_exception = issubclass(
                e.__class__, ContinueCustomException)

            error_string = e.message if is_continue_custom_exception else '\n\n'.join(
                traceback.format_tb(e.__traceback__)) + f"\n\n{e.__repr__()}"
            error_title = e.title if is_continue_custom_exception else e.__repr__()

            # Attach an InternalErrorObservation to the step and unhide it.
            print(f"Error while running step: \n{error_string}\n{error_title}")

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
            self.history.get_last_at_depth(
                self._step_depth, include_current=True).observation = observation
            await self.update_subscribers()

        # Update its description
        if step.description is None:
            async def update_description():
                step.description = await step.describe(self.continue_sdk.models)
                # Update subscribers with new description
                await self.update_subscribers()

            asyncio.create_task(update_description())

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
