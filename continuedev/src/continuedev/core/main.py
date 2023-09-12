import json
from typing import Any, Coroutine, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, validator
from pydantic.schema import schema

from ..models.main import ContinueBaseModel
from .observation import Observation

ChatMessageRole = Literal["assistant", "user", "system", "function"]


class FunctionCall(ContinueBaseModel):
    name: str
    arguments: str


class ChatMessage(ContinueBaseModel):
    role: ChatMessageRole
    content: Union[str, None] = None
    name: Union[str, None] = None
    # A summary for pruning chat context to fit context window. Often the Step name.
    summary: str
    function_call: Union[FunctionCall, None] = None

    def to_dict(self, with_functions: bool) -> Dict:
        d = self.dict()
        del d["summary"]
        if d["function_call"] is not None:
            d["function_call"]["name"] = d["function_call"]["name"].replace(" ", "")

        if d["content"] is None:
            d["content"] = ""
        for key, value in list(d.items()):
            if value is None:
                del d[key]

        if not with_functions:
            if d["role"] == "function":
                d["role"] = "assistant"
            if "name" in d:
                del d["name"]
            if "function_call" in d:
                del d["function_call"]
        return d


def resolve_refs(schema_data):
    def traverse(obj):
        if isinstance(obj, dict):
            if "$ref" in obj:
                ref = obj["$ref"]
                parts = ref.split("/")
                ref_obj = schema_data
                for part in parts[1:]:
                    ref_obj = ref_obj[part]
                return traverse(ref_obj)
            else:
                for key, value in obj.items():
                    obj[key] = traverse(value)
        elif isinstance(obj, list):
            for i in range(len(obj)):
                obj[i] = traverse(obj[i])
        return obj

    return traverse(schema_data)


unincluded_parameters = [
    "system_message",
    "chat_context",
    "manage_own_chat_context",
    "hide",
    "name",
    "description",
]


def step_to_json_schema(step) -> str:
    pydantic_class = step.__class__
    schema_data = schema([pydantic_class])
    resolved_schema = resolve_refs(schema_data)
    parameters = resolved_schema["definitions"][pydantic_class.__name__]
    for parameter in unincluded_parameters:
        if parameter in parameters["properties"]:
            del parameters["properties"][parameter]
    return {
        "name": step.name.replace(" ", ""),
        "description": step.description or "",
        "parameters": parameters,
    }


def step_to_fn_call_arguments(step: "Step") -> str:
    args = step.dict()
    for parameter in unincluded_parameters:
        if parameter in args:
            del args[parameter]
    return json.dumps(args)


class HistoryNode(ContinueBaseModel):
    """A point in history, a list of which make up History"""

    step: "Step"
    observation: Union[Observation, None]
    depth: int
    deleted: bool = False
    active: bool = True
    logs: List[str] = []

    def to_chat_messages(self) -> List[ChatMessage]:
        if self.step.description is None or self.step.manage_own_chat_context:
            return self.step.chat_context
        return self.step.chat_context + [
            ChatMessage(
                role="assistant",
                name=self.step.__class__.__name__,
                content=self.step.description or f"Ran function {self.step.name}",
                summary=f"Called function {self.step.name}",
            )
        ]


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
        """Add node and return the index where it was added"""
        self.timeline.insert(self.current_index + 1, node)
        self.current_index += 1
        return self.current_index

    def get_current(self) -> Union[HistoryNode, None]:
        if self.current_index < 0:
            return None
        return self.timeline[self.current_index]

    def get_last_at_depth(
        self, depth: int, include_current: bool = False
    ) -> Union[HistoryNode, None]:
        i = self.current_index if include_current else self.current_index - 1
        while i >= 0:
            if (
                self.timeline[i].depth == depth
                and type(self.timeline[i].step).__name__ != "ManualEditStep"
            ):
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


class SlashCommandDescription(ContinueBaseModel):
    name: str
    description: str


class ContextItemId(BaseModel):
    """
    A ContextItemId is a unique identifier for a ContextItem.
    """

    provider_title: str
    item_id: str

    @validator("provider_title", "item_id")
    def must_be_valid_id(cls, v):
        import re

        if not re.match(r"^[0-9a-zA-Z_-]*$", v):
            raise ValueError(
                "Both provider_title and item_id can only include characters 0-9, a-z, A-Z, -, and _"
            )
        return v

    def to_string(self) -> str:
        return f"{self.provider_title}-{self.item_id}"

    @staticmethod
    def from_string(string: str) -> "ContextItemId":
        provider_title, *rest = string.split("-")
        item_id = "-".join(rest)
        return ContextItemId(provider_title=provider_title, item_id=item_id)


class ContextItemDescription(BaseModel):
    """
    A ContextItemDescription is a description of a ContextItem that is displayed to the user when they type '@'.

    The id can be used to retrieve the ContextItem from the ContextManager.
    """

    name: str
    description: str
    id: ContextItemId


class ContextItem(BaseModel):
    """
    A ContextItem is a single item that is stored in the ContextManager.
    """

    description: ContextItemDescription
    content: str

    @validator("content", pre=True)
    def content_must_be_string(cls, v):
        if v is None:
            return ""
        return v

    editing: bool = False
    editable: bool = False


class SessionInfo(ContinueBaseModel):
    session_id: str
    title: str
    date_created: str
    workspace_directory: Optional[str] = None


class ContinueConfig(ContinueBaseModel):
    system_message: Optional[str]
    temperature: Optional[float]

    class Config:
        extra = "allow"

    def dict(self, **kwargs):
        original_dict = super().dict(**kwargs)
        original_dict.pop("policy", None)
        return original_dict


class ContextProviderDescription(BaseModel):
    title: str
    display_title: str
    description: str
    dynamic: bool
    requires_query: bool


class FullState(ContinueBaseModel):
    """A full state of the program, including the history"""

    history: History
    active: bool
    user_input_queue: List[str]
    slash_commands: List[SlashCommandDescription]
    adding_highlighted_code: bool
    selected_context_items: List[ContextItem]
    session_info: Optional[SessionInfo] = None
    config: ContinueConfig
    saved_context_groups: Dict[str, List[ContextItem]] = {}
    context_providers: List[ContextProviderDescription] = []


class ContinueSDK:
    ...


class Models:
    ...


class Policy(ContinueBaseModel):
    """A rule that determines which step to take next"""

    # Note that history is mutable, kinda sus
    def next(
        self, config: ContinueConfig, history: History = History.from_empty()
    ) -> "Step":
        raise NotImplementedError


class Step(ContinueBaseModel):
    name: str = None
    hide: bool = False
    description: Union[str, None] = None

    system_message: Union[str, None] = None
    chat_context: List[ChatMessage] = []
    manage_own_chat_context: bool = False

    class Config:
        copy_on_model_validation = False

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        if self.description is not None:
            return self.description
        return "Running step: " + self.name

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        # Make sure description is always a string
        d["description"] = self.description or ""
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
    steps: List[Step]
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
    key_value: Dict[str, Any] = {}

    def set(self, key: str, value: Any):
        self.key_value[key] = value

    def get(self, key: str) -> Any:
        return self.key_value.get(key, None)


class ContinueCustomException(Exception):
    title: str
    message: str
    with_step: Union[Step, None]

    def __init__(
        self,
        message: str,
        title: str = "Error while running step:",
        with_step: Union[Step, None] = None,
    ):
        self.message = message
        self.title = title
        self.with_step = with_step


HistoryNode.update_forward_refs()
