import asyncio
import os
from functools import wraps

import pytest
from dotenv import load_dotenv

from continuedev.core.main import ChatMessage
from continuedev.libs.llm import LLM, CompletionOptions
from continuedev.libs.llm.anthropic import AnthropicLLM
from continuedev.libs.llm.ggml import GGML
from continuedev.libs.llm.openai import OpenAI
from continuedev.libs.llm.together import TogetherLLM
from continuedev.libs.util.count_tokens import DEFAULT_ARGS
from continuedev.tests.util.prompts import tokyo_test_pair

load_dotenv()


SPEND_MONEY = True


def start_model(model):
    def write_log(msg: str):
        pass

    asyncio.run(model.start(write_log=write_log, unique_id="test_unique_id"))


def async_test(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return asyncio.run(func(*args, **kwargs))

    return wrapper


class TestBaseLLM:
    model = "gpt-3.5-turbo"
    context_length = 4096
    system_message = "test_system_message"

    def setup_class(cls):
        cls.llm = LLM(
            model=cls.model,
            context_length=cls.context_length,
            system_message=cls.system_message,
        )

        start_model(cls.llm)

    def test_llm_is_instance(self):
        assert isinstance(self.llm, LLM)

    def test_llm_collect_args(self):
        options = CompletionOptions(model=self.model)
        assert self.llm.collect_args(options) == {
            **DEFAULT_ARGS,
            "model": self.model,
        }

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
            assert isinstance(chunk, dict)
            if "content" in chunk:
                completion += chunk["content"]
            if "role" in chunk:
                role = chunk["role"]

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
    def setup_class(cls):
        super().setup_class(cls)
        cls.llm = OpenAI(
            model=cls.model,
            context_length=cls.context_length,
            system_message=cls.system_message,
            api_key=os.environ["OPENAI_API_KEY"],
            # api_base=f"http://localhost:{port}",
        )
        start_model(cls.llm)
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
    def setup_class(cls):
        super().setup_class(cls)
        cls.llm = GGML(
            model="gpt-3.5-turbo",
            context_length=cls.context_length,
            system_message=cls.system_message,
            server_url="https://api.openai.com",
            api_key=os.environ["OPENAI_API_KEY"],
        )
        start_model(cls.llm)


@pytest.mark.skipif(True, reason="Together is not working")
class TestTogetherLLM(TestBaseLLM):
    def setup_class(cls):
        super().setup_class(cls)
        cls.llm = TogetherLLM(
            api_key=os.environ["TOGETHER_API_KEY"],
        )
        start_model(cls.llm)


class TestAnthropicLLM(TestBaseLLM):
    def setup_class(cls):
        super().setup_class(cls)
        cls.llm = AnthropicLLM(api_key=os.environ["ANTHROPIC_API_KEY"])
        start_model(cls.llm)

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
