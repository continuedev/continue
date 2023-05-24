import traceback
import time
from typing import Callable, Coroutine, Dict, Generator, List, Tuple, Union
from ..models.filesystem_edit import EditDiff, FileEdit, FileEditWithFullContents, FileSystemEdit
from ..models.filesystem import FileSystem
from pydantic import BaseModel, parse_file_as, validator
from .llm import LLM
from .observation import Observation, UserInputObservation
from ..server.ide_protocol import AbstractIdeProtocolServer
from .util.queue import AsyncSubscriptionQueue


class ContinueBaseModel(BaseModel):
    class Config:
        underscore_attrs_are_private = True


class HistoryNode(ContinueBaseModel):
    """A point in history, a list of which make up History"""
    step: "Step"
    observation: Union[Observation, None]
    depth: int


class History(ContinueBaseModel):
    """A history of steps taken and their results"""
    timeline: List[HistoryNode]
    current_index: int

    def add_node(self, node: HistoryNode):
        self.timeline.insert(self.current_index + 1, node)
        self.current_index += 1

    def get_current(self) -> Union[HistoryNode, None]:
        if self.current_index < 0:
            return None
        return self.timeline[self.current_index]

    def remove_current_and_substeps(self):
        self.timeline.pop(self.current_index)
        while self.get_current() is not None and self.get_current().depth > 0:
            self.timeline.pop(self.current_index)

    def take_next_step(self) -> Union["Step", None]:
        if self.has_future():
            self.current_index += 1
            current_state = self.get_current()
            if current_state is None:
                return None
            return current_state.step
        return None

    def get_current_index(self) -> int:
        return self.current_index

    def has_future(self) -> bool:
        return self.current_index < len(self.timeline) - 1

    def step_back(self):
        self.current_index -= 1

    def last_observation(self) -> Union[Observation, None]:
        state = self.get_current()
        if state is None:
            return None
        return state.observation

    @classmethod
    def from_empty(cls):
        return cls(timeline=[], current_index=-1)


class FullState(ContinueBaseModel):
    """A full state of the program, including the history"""
    history: History
    active: bool
    user_input_queue: List[str]


class Policy(ContinueBaseModel):
    """A rule that determines which step to take next"""

    # Note that history is mutable, kinda sus
    def next(self, history: History = History.from_empty()) -> "Step":
        raise NotImplementedError


class ContinueSDK:
    """The SDK provided as parameters to a step"""
    llm: LLM
    ide: AbstractIdeProtocolServer
    __agent: "Agent"

    def __init__(self, agent: "Agent", llm: Union[LLM, None] = None):
        if llm is None:
            self.llm = agent.llm
        else:
            self.llm = llm
        self.ide = agent.ide
        self.__agent = agent

    @property
    def history(self) -> History:
        return self.__agent.history

    async def run_step(self, step: "Step") -> Coroutine[Observation, None, None]:
        return await self.__agent._run_singular_step(step)

    async def apply_filesystem_edit(self, edit: FileSystemEdit):
        await self.run_step(FileSystemEditStep(edit=edit))

    async def wait_for_user_input(self) -> str:
        return await self.__agent.wait_for_user_input()


class Agent(ContinueBaseModel):
    llm: LLM
    policy: Policy
    ide: AbstractIdeProtocolServer
    history: History = History.from_empty()
    _on_update_callbacks: List[Callable[["FullState"], None]] = []

    _active: bool = False
    _should_halt: bool = False
    _main_user_input_queue: List[str] = []

    _user_input_queue = AsyncSubscriptionQueue()

    class Config:
        arbitrary_types_allowed = True

    def get_full_state(self) -> FullState:
        return FullState(history=self.history, active=self._active, user_input_queue=self._main_user_input_queue)

    def on_update(self, callback: Callable[["FullState"], None]):
        """Subscribe to changes to state"""
        self._on_update_callbacks.append(callback)

    def update_subscribers(self):
        full_state = self.get_full_state()
        for callback in self._on_update_callbacks:
            callback(full_state)

    def __get_step_params(self, step: "Step"):
        return ContinueSDK(agent=self, llm=self.llm.with_system_message(step.system_message))

    def give_user_input(self, input: str, index: int):
        self._user_input_queue.post(index, input)

    async def wait_for_user_input(self) -> str:
        self._active = False
        self.update_subscribers()
        await self._user_input_queue.get(self.history.current_index)
        self._active = True
        self.update_subscribers()

    _manual_edits_buffer: List[FileEditWithFullContents] = []

    async def reverse_to_index(self, index: int):
        try:
            while self.history.get_current_index() >= index:
                current_step = self.history.get_current().step
                self.history.step_back()
                if issubclass(current_step.__class__, ReversibleStep):
                    await current_step.reverse(self.__get_step_params(current_step))

                self.update_subscribers()
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
        observation = await step(self.__get_step_params(step))
        self._step_depth -= 1

        # Add observation to history
        self.history.get_current().observation = observation

        # Update its description
        step._set_description(await step.describe(self.llm))

        # Call all subscribed callbacks
        self.update_subscribers()

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
            callback(None)

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
        self.update_subscribers()

        if len(self._main_user_input_queue) > 1:
            return

        # await self._request_halt()
        # Just run the step that takes user input, and
        # then up to the policy to decide how to deal with it.
        self._main_user_input_queue.pop(0)
        self.update_subscribers()
        await self.run_from_step(UserInputStep(user_input=user_input))

        while len(self._main_user_input_queue) > 0:
            await self.run_from_step(UserInputStep(
                user_input=self._main_user_input_queue.pop(0)))

    async def accept_refinement_input(self, user_input: str, index: int):
        await self._request_halt()
        await self.reverse_to_index(index)
        await self.run_from_step(UserInputStep(user_input=user_input))


class Step(ContinueBaseModel):
    name: str = None
    hide: bool = False
    _description: Union[str, None] = None

    system_message: Union[str, None] = None

    class Config:
        copy_on_model_validation = False

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        if self._description is not None:
            return self._description
        return "Running step: " + self.name

    def _set_description(self, description: str):
        self._description = description

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        if self._description is not None:
            d["description"] = self._description
        else:
            d["description"] = self.name
        return d

    @validator("name", pre=True, always=True)
    def name_is_class_name(cls, name):
        if name is None:
            return cls.__name__
        return name

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        raise NotImplementedError

    async def __call__(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return await self.run(sdk)

    def __rshift__(self, other: "Step"):
        steps = []
        if isinstance(self, SequentialStep):
            steps = self.steps
        else:
            steps.append(self)
        if isinstance(other, SequentialStep):
            steps += other.steps
        else:
            steps.append(other)
        return SequentialStep(steps=steps)


class SequentialStep(Step):
    steps: list[Step]
    hide: bool = True

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        for step in self.steps:
            observation = await sdk.run_step(step)
        return observation


class ReversibleStep(Step):
    async def reverse(self, sdk: ContinueSDK):
        raise NotImplementedError


class FileSystemEditStep(ReversibleStep):
    edit: FileSystemEdit
    _diff: Union[EditDiff, None] = None

    hide: bool = True

    async def run(self, sdk: "ContinueSDK") -> Coroutine[Observation, None, None]:
        self._diff = await sdk.ide.applyFileSystemEdit(self.edit)
        return None

    async def reverse(self, sdk: "ContinueSDK"):
        await sdk.ide.applyFileSystemEdit(self._diff.backward)
        # Where and when should file saves happen?


class ManualEditStep(ReversibleStep):
    edit_diff: EditDiff
    hide: bool = True

    hide: bool = True

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        return "Manual edit step"
        # TODO - only handling FileEdit here, but need all other types of FileSystemEdits
        # Also requires the merge_file_edit function
        # return llm.complete(dedent(f"""This code was replaced:

        #     {self.edit_diff.backward.replacement}

        #     With this code:

        #     {self.edit_diff.forward.replacement}

        #     Maximally concise summary of changes in bullet points (can use markdown):
        # """))

    @classmethod
    def from_sequence(cls, edits: List[FileEditWithFullContents]) -> "ManualEditStep":
        diffs = []
        for edit in edits:
            _, diff = FileSystem.apply_edit_to_str(
                edit.fileContents, edit.fileEdit)
            diffs.append(diff)
        return cls(edit_diff=EditDiff.from_sequence(diffs))

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return None

    async def reverse(self, sdk: ContinueSDK):
        await sdk.ide.applyFileSystemEdit(self.edit_diff.backward)


class UserInputStep(Step):
    user_input: str
    name: str = "User Input"
    hide: bool = True

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        return self.user_input

    async def run(self, sdk: ContinueSDK) -> Coroutine[UserInputObservation, None, None]:
        return UserInputObservation(user_input=self.user_input)


class ValidatorObservation(Observation):
    passed: bool
    observation: Observation


class Validator(Step):
    def run(self, sdk: ContinueSDK) -> ValidatorObservation:
        raise NotImplementedError


HistoryNode.update_forward_refs()
