from pydantic import BaseModel, validator

from ..models.main import Traceback


class Observation(BaseModel):
    pass


class TracebackObservation(Observation):
    traceback: Traceback


class ValidatorObservation(Observation):
    passed: bool


class UserInputObservation(Observation):
    user_input: str


class DictObservation(Observation):
    values: dict

    def __getitem__(self, key):
        return self.values[key]


class TextObservation(Observation):
    text: str

    @validator("text", pre=True, always=True)
    def text_not_none(cls, v):
        if v is None:
            return ""
        return v


class InternalErrorObservation(Observation):
    title: str
    error: str
