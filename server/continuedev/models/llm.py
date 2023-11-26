from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator

from .main import ContinueBaseModel


class RequestOptions(BaseModel):
    timeout: Optional[int] = Field(
        default=300,
        description="Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.",
    )
    verify_ssl: Optional[bool] = Field(
        default=None, description="Whether to verify SSL certificates for requests."
    )
    ca_bundle_path: str = Field(
        default=None,
        description="Path to a custom CA bundle to use when making the HTTP request",
    )
    proxy: Optional[str] = Field(
        default=None,
        description="Proxy URL to use when making the HTTP request",
    )
    headers: Optional[Dict[str, str]] = Field(
        default=None,
        description="Headers to use when making the HTTP request",
    )


class BaseCompletionOptions(ContinueBaseModel):
    @validator(
        "*",
        pre=True,
        always=True,
    )
    def ignore_none_and_set_default(cls, value, field):
        return value if value is not None else field.default

    temperature: Optional[float] = Field(
        default=None, description="The temperature of the completion."
    )
    top_p: Optional[float] = Field(
        default=None, description="The top_p of the completion."
    )
    top_k: Optional[int] = Field(
        default=None, description="The top_k of the completion."
    )
    presence_penalty: Optional[float] = Field(
        default=None, description="The presence penalty Aof the completion."
    )
    frequency_penalty: Optional[float] = Field(
        default=None, description="The frequency penalty of the completion."
    )
    stop: Optional[List[str]] = Field(
        default=None, description="The stop tokens of the completion."
    )
    max_tokens: int = Field(
        default=1023,
        description="The maximum number of tokens to generate.",
    )


class CompletionOptions(BaseCompletionOptions):
    """Options for the completion."""

    @validator(
        "*",
        pre=True,
        always=True,
    )
    def ignore_none_and_set_default(cls, value, field):
        return value if value is not None else field.default

    model: str = Field(default=None, description="The model name")
    functions: Optional[List[Any]] = Field(
        default=None, description="The functions/tools to make available to the model."
    )


class PromptTemplate(CompletionOptions):
    prompt: str = Field(
        default=..., description="The prompt to be used for the completion."
    )
    raw: bool = Field(
        default=False, description="Whether to use the raw prompt or not."
    )
