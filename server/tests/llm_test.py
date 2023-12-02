import asyncio
import os
from functools import wraps

import pytest
from continuedev.core.main import ChatMessage
from continuedev.libs.llm.anthropic import AnthropicLLM
from continuedev.libs.llm.base import LLM, CompletionOptions
from continuedev.libs.llm.ggml import GGML
from continuedev.libs.llm.openai import OpenAI
from continuedev.libs.llm.together import TogetherLLM
from continuedev.libs.util.count_tokens import DEFAULT_ARGS
from dotenv import load_dotenv

from .util.prompts import tokyo_test_pair

load_dotenv()


SPEND_MONEY = False


def start_model(model: LLM):
    model.start(unique_id="test_unique_id")


def async_test(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return asyncio.run(func(*args, **kwargs))

    return wrapper


class TestBaseLLM:
    model = "gpt-3.5-turbo"
    context_length = 4096
    system_message = "test_system_message"

    def setup_class(self):
        self.llm = LLM(
            model=self.model,
            context_length=self.context_length,
            system_message=self.system_message,
        )

        start_model(self.llm)

    def test_llm_is_instance(self):
        assert isinstance(self.llm, LLM)

    def test_llm_collect_args(self):
        options = CompletionOptions(model=self.model)
        args = self.llm.collect_args(options)
        for k, v in {
            **DEFAULT_ARGS,
            "model": self.model,
        }.items():
            assert args[k] == v

    @pytest.mark.skipif(SPEND_MONEY is False, reason="Costs money")
    @async_test
    async def test_completion(self):
        if self.llm.__class__.__name__ == "LLM":
            pytest.skip("Skipping abstract LLM")

        resp = await self.llm.complete(tokyo_test_pair[0], temperature=0.0)
        assert isinstance(resp, str)
        assert resp.strip().lower() == tokyo_test_pair[1]

    @pytest.mark.skipif(SPEND_MONEY is False, reason="Costs money")
    @async_test
    async def test_stream_chat(self):
        if self.llm.__class__.__name__ == "LLM":
            pytest.skip("Skipping abstract LLM")

        completion = ""
        role = None
        async for chunk in self.llm.stream_chat(
            messages=[
                ChatMessage(
                    role="user", content=tokyo_test_pair[0], summary=tokyo_test_pair[0]
                )
            ],
            temperature=0.0,
        ):
            assert isinstance(chunk, ChatMessage)
            completion += chunk.content
            role = chunk.role

        assert role == "assistant"
        assert completion.strip().lower() == tokyo_test_pair[1]

    @pytest.mark.skipif(SPEND_MONEY is False, reason="Costs money")
    @async_test
    async def test_stream_complete(self):
        if self.llm.__class__.__name__ == "LLM":
            pytest.skip("Skipping abstract LLM")

        completion = ""
        async for chunk in self.llm.stream_complete(
            tokyo_test_pair[0], temperature=0.0
        ):
            assert isinstance(chunk, str)
            completion += chunk

        assert completion.strip().lower() == tokyo_test_pair[1]


class TestOpenAI(TestBaseLLM):
    def setup_class(self):
        super().setup_class(self)  # type: ignore
        self.llm = OpenAI(
            model=self.model,
            context_length=self.context_length,
            system_message=self.system_message,
            api_key=os.environ["OPENAI_API_KEY"],
            # api_base=f"http://localhost:{port}",
        )
        start_model(self.llm)
        # cls.server = start_openai(port=port)

    # def teardown_class(cls):
    # cls.server.terminate()

    @pytest.mark.asyncio
    @pytest.mark.skipif(SPEND_MONEY is False, reason="Costs money")
    async def test_completion(self):
        resp = await self.llm.complete(
            "Output a single word, that being the capital of Japan:"
        )
        assert isinstance(resp, str)
        assert resp.strip().lower() == tokyo_test_pair[1]


class TestGGML(TestBaseLLM):
    def setup_class(self):
        super().setup_class(self)  # type: ignore
        self.llm = GGML(
            model="gpt-3.5-turbo",
            context_length=self.context_length,
            system_message=self.system_message,
            api_base="https://api.openai.com",
            api_key=os.environ["OPENAI_API_KEY"],
        )
        start_model(self.llm)


@pytest.mark.skipif(True, reason="Together is not working")
class TestTogetherLLM(TestBaseLLM):
    def setup_class(self):
        super().setup_class(self)  # type: ignore
        self.llm = TogetherLLM(
            api_key=os.environ["TOGETHER_API_KEY"],
        )
        start_model(self.llm)


class TestAnthropicLLM(TestBaseLLM):
    def setup_class(self):
        super().setup_class(self)  # type: ignore
        self.llm = AnthropicLLM(api_key=os.environ["ANTHROPIC_API_KEY"])
        start_model(self.llm)

    def test_llm_collect_args(self):
        options = CompletionOptions(model=self.model)
        assert self.llm.collect_args(options) == {
            "max_tokens_to_sample": DEFAULT_ARGS["max_tokens"],
            "temperature": DEFAULT_ARGS["temperature"],
            "model": self.model,
        }


if __name__ == "__main__":
    import pytest

    pytest.main()
