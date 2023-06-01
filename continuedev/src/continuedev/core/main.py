from typing import Callable, Coroutine, Dict, Generator, List, Tuple, Union

from ..models.main import ContinueBaseModel
from pydantic import validator
from ..libs.llm import LLM
from .observation import Observation


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

    def get_last_at_depth(self, depth: int, include_current: bool = False) -> Union[HistoryNode, None]:
        i = self.current_index if include_current else self.current_index - 1
        while i >= 0:
            if self.timeline[i].depth == depth and type(self.timeline[i].step).__name__ != "ManualEditStep":
                return self.timeline[i]
            i -= 1
        return None

    def get_last_at_same_depth(self) -> Union[HistoryNode, None]:
        return self.get_last_at_depth(self.get_current().depth)

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
        state = self.get_last_at_same_depth()
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


class ContinueSDK:
    pass


class Models:
    pass


class Policy(ContinueBaseModel):
    """A rule that determines which step to take next"""

    # Note that history is mutable, kinda sus
    def next(self, history: History = History.from_empty()) -> "Step":
        raise NotImplementedError


class Step(ContinueBaseModel):
    name: str = None
    hide: bool = False
    _description: Union[str, None] = None

    system_message: Union[str, None] = None

    class Config:
        copy_on_model_validation = False

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
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


class ValidatorObservation(Observation):
    passed: bool
    observation: Observation


class Validator(Step):
    def run(self, sdk: ContinueSDK) -> ValidatorObservation:
        raise NotImplementedError


HistoryNode.update_forward_refs()
