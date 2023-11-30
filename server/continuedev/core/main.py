import json
from typing import Any, AsyncGenerator, Dict, List, Literal, Optional, Union, cast

from pydantic import BaseModel, Field, validator
from pydantic.schema import schema

from ..models.main import ContinueBaseModel
from .observation import Observation

ChatMessageRole = Literal["assistant", "user", "system", "function"]


class FunctionCall(ContinueBaseModel):
    name: str
    arguments: str


class ChatMessage(ContinueBaseModel):
    role: ChatMessageRole
    content: str = ""
    name: Optional[str] = None
    # A summary for pruning chat context to fit context window. Often the Step name.
    summary: str = Field(default=None, title="Summary")
    function_call: Optional[FunctionCall] = None

    @validator("summary", pre=True, always=True)
    def summary_is_content(cls, summary, values):
        if summary is None:
            return values.get("content", "")
        return summary

    def to_dict(self, with_functions: bool = False) -> Dict[str, str]:
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


def step_to_json_schema(step) -> Dict[str, Any]:
    pydantic_class = step.__class__
    schema_data = schema([pydantic_class])
    resolved_schema = cast(Dict[str, Any], resolve_refs(schema_data))
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


class ContinueError(BaseModel):
    title: str
    message: str


class SetStep(BaseModel):
    step_type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None

    params: Optional[Dict[str, Any]] = None

    hide: Optional[bool] = None
    depth: Optional[int] = None

    error: Optional[ContinueError] = None
    observations: Optional[List[Observation]] = None
    logs: Optional[List[str]] = None

    def dict(self, *args, **kwargs):
        kwargs["exclude_none"] = True
        return super().dict(*args, **kwargs)


class DeltaStep(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

    observations: Optional[List[Observation]] = None
    logs: Optional[List[str]] = None

    def dict(self, *args, **kwargs):
        kwargs["exclude_none"] = True
        return super().dict(*args, **kwargs)


class StepDescription(BaseModel):
    step_type: str
    name: str
    description: str

    params: Dict[str, Any]

    hide: bool
    depth: int

    error: Optional[ContinueError] = None
    observations: List[Observation] = []
    logs: List[str] = []

    def update(self, update: "UpdateStep"):
        if isinstance(update, DeltaStep):
            for key, value in update.dict(exclude_none=True).items():
                setattr(self, key, getattr(self, key) + value)
        elif isinstance(update, SetStep):
            for key, value in update.dict(exclude_none=True).items():
                setattr(self, key, value)


class SessionUpdate(BaseModel):
    index: int
    update: "UpdateStep"
    stop: Optional[bool] = None

    class Config:
        smart_union = True

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        # Because the front-end doesn't see the Model type
        d["delta"] = isinstance(self.update, DeltaStep)
        return d


UpdateStep = Union[DeltaStep, SetStep, SessionUpdate]

SessionUpdate.update_forward_refs()

StepGenerator = AsyncGenerator[Union[str, UpdateStep, Observation], None]
AutopilotGeneratorOutput = Union[SessionUpdate, StepDescription]
AutopilotGenerator = AsyncGenerator[AutopilotGeneratorOutput, None]


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

    def __eq__(self, other):
        return (
            self.provider_title == other.provider_title
            and self.item_id == other.item_id
        )

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


class SessionState(ContinueBaseModel):
    """Full session history and important state needed for autopilot to Continue"""

    history: List[StepDescription]
    context_items: List[ContextItem]
    # future: List = []

    @staticmethod
    def from_empty():
        return SessionState(history=[], context_items=[])


class ContinueSDK:
    async def run_step(self, step: "Step"):
        ...


class Models:
    ...


class Policy(ContinueBaseModel):
    """A rule that determines which step to take next"""

    # Note that history is mutable, kinda sus
    def next(
        self, config: ContinueConfig, session_state: SessionState
    ) -> Optional["Step"]:
        raise NotImplementedError


class Step(ContinueBaseModel):
    name: str = Field(default=None, title="Name")
    hide: bool = False
    description: str = ""

    class_name: str = "Step"

    @validator("class_name", pre=True, always=True)
    def class_name_is_class_name(cls, class_name):
        return cls.__name__

    system_message: Union[str, None] = None
    chat_context: List[ChatMessage] = []
    manage_own_chat_context: bool = False

    class Config:
        copy_on_model_validation = False

    async def describe(self, models: Models) -> str:
        if self.description is not None:
            return self.description
        return "Running step: " + self.name

    def on_stop(self, sdk: ContinueSDK) -> Optional[StepGenerator]:
        return None

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

    async def run(self, sdk: ContinueSDK) -> StepGenerator:
        raise NotImplementedError

    async def __call__(self, sdk: ContinueSDK) -> StepGenerator:
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

    async def run(self, sdk: ContinueSDK):
        for step in self.steps:
            await sdk.run_step(step)


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
