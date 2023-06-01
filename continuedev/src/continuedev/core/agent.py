import traceback
import time
from typing import Callable, Coroutine, List
from ..models.filesystem_edit import FileEditWithFullContents
from ..libs.llm import LLM
from .observation import Observation
from ..server.ide_protocol import AbstractIdeProtocolServer
from ..libs.util.queue import AsyncSubscriptionQueue
from ..models.main import ContinueBaseModel
from .main import Policy, History, FullState, Step, HistoryNode
from ..libs.steps.core.core import ReversibleStep, ManualEditStep, UserInputStep
from .sdk import ContinueSDK


class Agent(ContinueBaseModel):
    policy: Policy
    ide: AbstractIdeProtocolServer
    history: History = History.from_empty()
    _on_update_callbacks: List[Callable[[FullState], None]] = []

    _active: bool = False
    _should_halt: bool = False
    _main_user_input_queue: List[str] = []

    _user_input_queue = AsyncSubscriptionQueue()

    class Config:
        arbitrary_types_allowed = True

    def get_full_state(self) -> FullState:
        return FullState(history=self.history, active=self._active, user_input_queue=self._main_user_input_queue)

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
                    await current_step.reverse(ContinueSDK(self))

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

    async def _run_singular_step(self, step: "Step", is_future_step: bool = False) -> Coroutine[Observation, None, None]:
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

        # Run step
        self._step_depth += 1
        observation = await step(ContinueSDK(self))
        self._step_depth -= 1

        # Add observation to history
        self.history.get_last_at_depth(
            self._step_depth, include_current=True).observation = observation

        # Update its description
        step._set_description(await step.describe(ContinueSDK(self).models))

        # Call all subscribed callbacks
        await self.update_subscribers()

        return observation

    async def run_from_step(self, step: "Step"):
        # if self._active:
        #     raise RuntimeError("Agent is already running")
        self._active = True

        next_step = step
        is_future_step = False
        while not (next_step is None or self._should_halt):
            try:
                if is_future_step:
                    # If future step, then we are replaying and need to delete the step from history so it can be replaced
                    self.history.remove_current_and_substeps()

                observation = await self._run_singular_step(next_step, is_future_step)
                if next_step := self.policy.next(self.history):
                    is_future_step = False
                elif next_step := self.history.take_next_step():
                    is_future_step = True
                else:
                    next_step = None

            except Exception as e:
                print(
                    f"Error while running step: \n{''.join(traceback.format_tb(e.__traceback__))}\n{e}")
                next_step = None

        self._active = False

        # Doing this so active can make it to the frontend after steps are done. But want better state syncing tools
        for callback in self._on_update_callbacks:
            await callback(None)

    async def run_from_observation(self, observation: Observation):
        next_step = self.policy.next(self.history)
        await self.run_from_step(next_step)

    async def run_policy(self):
        first_step = self.policy.next(self.history)
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
