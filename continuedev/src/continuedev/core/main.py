from textwrap import dedent
from typing import Callable, Coroutine, Dict, Generator, List, Literal, Tuple, Union

from ..models.main import ContinueBaseModel
from pydantic import validator
from .observation import Observation

ChatMessageRole = Literal["assistant", "user", "system"]


class ChatMessage(ContinueBaseModel):
    role: ChatMessageRole
    content: str
    # A summary for pruning chat context to fit context window. Often the Step name.
    summary: str


class HistoryNode(ContinueBaseModel):
    """A point in history, a list of which make up History"""
    step: "Step"
    observation: Union[Observation, None]
    depth: int
    deleted: bool = False
    active: bool = True

    def to_chat_messages(self) -> List[ChatMessage]:
        if self.step.description is None:
            return self.step.chat_context
        return self.step.chat_context + [ChatMessage(role="assistant", content=self.step.description, summary=self.step.name)]


class History(ContinueBaseModel):
    """A history of steps taken and their results"""
    timeline: List[HistoryNode]
    current_index: int

    def to_chat_history(self) -> List[ChatMessage]:
        msgs = []
        for node in self.timeline:
            if not node.step.hide:
                msgs += node.to_chat_messages()
        return msgs

    def add_node(self, node: HistoryNode) -> int:
        """ Add node and return the index where it was added """
        self.timeline.insert(self.current_index + 1, node)
        self.current_index += 1
        return self.current_index

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

    def pop_step(self, index: int = None) -> Union[HistoryNode, None]:
        index = index if index is not None else self.current_index
        if index < 0 or self.current_index < 0:
            return None

        node = self.timeline.pop(index)

        if index <= self.current_index:
            self.current_index -= 1

        return node.step

    @classmethod
    def from_empty(cls):
        return cls(timeline=[], current_index=-1)


class FullState(ContinueBaseModel):
    """A full state of the program, including the history"""
    history: History
    active: bool
    user_input_queue: List[str]
    default_model: str


class ContinueSDK:
    pass


class Models:
    pass


class ContinueConfig:
    pass


class Policy(ContinueBaseModel):
    """A rule that determines which step to take next"""

    # Note that history is mutable, kinda sus
    def next(self, config: ContinueConfig, history: History = History.from_empty()) -> "Step":
        raise NotImplementedError


class Step(ContinueBaseModel):
    name: str = None
    hide: bool = False
    description: Union[str, None] = None

    system_message: Union[str, None] = None
    chat_context: List[ChatMessage] = []

    class Config:
        copy_on_model_validation = False

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        if self.description is not None:
            return self.description
        return "Running step: " + self.name

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        if self.description is not None:
            d["description"] = self.description
        else:
            d["description"] = "`Step in progress...`"
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


class Context:
    key_value: Dict[str, str] = {}

    def set(self, key: str, value: str):
        self.key_value[key] = value

    def get(self, key: str) -> str:
        return self.key_value[key]


class ContinueCustomException(Exception):
    title: str
    message: str
    with_step: Union[Step, None]

    def __init__(self, message: str, title: str = "Error while running step:", with_step: Union[Step, None] = None):
        self.message = message
        self.title = title
        self.with_step = with_step


HistoryNode.update_forward_refs()
