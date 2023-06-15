import asyncio
from functools import cached_property
import time
from typing import Any, Dict, Generator, List, Union
from ...core.main import ChatMessage
import openai
import aiohttp
from ..llm import LLM
from pydantic import BaseModel, validator
import tiktoken

MAX_TOKENS_FOR_MODEL = {
    "gpt-3.5-turbo": 4097,
    "gpt-4": 4097,
}
DEFAULT_MAX_TOKENS = 2048
CHAT_MODELS = {
    "gpt-3.5-turbo", "gpt-4"
}


class OpenAI(LLM):
    api_key: str
    completion_count: int = 0
    default_model: str

    def __init__(self, api_key: str, default_model: str = "gpt-3.5-turbo", system_message: str = None):
        self.api_key = api_key
        self.default_model = default_model
        self.system_message = system_message

    @validator("api_key", pre=True, always=True)
    def validate_api_key(cls, v):
        openai.api_key = v
        return v

    @cached_property
    def __encoding_for_model(self):
        aliases = {
            "gpt-3.5-turbo": "gpt3"
        }
        return tiktoken.encoding_for_model(self.default_model)

    def count_tokens(self, text: str):
        return len(self.__encoding_for_model.encode(text, disallowed_special=()))

    def __prune_chat_history(self, chat_history: List[ChatMessage], max_tokens: int, tokens_for_completion: int):
        tokens = tokens_for_completion
        for i in range(len(chat_history) - 1, -1, -1):
            message = chat_history[i]
            tokens += self.count_tokens(message.content)
            if tokens > max_tokens:
                return chat_history[i + 1:]
        return chat_history

    def with_system_message(self, system_message: Union[str, None]):
        return OpenAI(api_key=self.api_key, system_message=system_message)

    def stream_chat(self, prompt, with_history: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        self.completion_count += 1
        args = {"max_tokens": DEFAULT_MAX_TOKENS, "temperature": 0.5, "top_p": 1,
                "frequency_penalty": 0, "presence_penalty": 0} | kwargs
        args["stream"] = True
        args["model"] = "gpt-3.5-turbo"

        for chunk in openai.ChatCompletion.create(
            messages=self.compile_chat_messages(with_history, prompt),
            **args,
        ):
            if "content" in chunk.choices[0].delta:
                yield chunk.choices[0].delta.content
            else:
                continue

    def compile_chat_messages(self, msgs: List[ChatMessage], prompt: str) -> List[Dict]:
        msgs = self.__prune_chat_history(msgs, MAX_TOKENS_FOR_MODEL[self.default_model], self.count_tokens(
            prompt) + 1000 + self.count_tokens(self.system_message or ""))
        history = []
        if self.system_message:
            history.append({
                "role": "system",
                "content": self.system_message
            })
        history += [msg.dict() for msg in msgs]
        history.append({
            "role": "user",
            "content": prompt
        })

        return history

    def stream_complete(self, prompt: str, with_history: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        self.completion_count += 1
        args = {"model": self.default_model, "max_tokens": DEFAULT_MAX_TOKENS, "temperature": 0.5,
                "top_p": 1, "frequency_penalty": 0, "presence_penalty": 0, "suffix": None} | kwargs
        args["stream"] = True

        if args["model"] in CHAT_MODELS:
            generator = openai.ChatCompletion.create(
                messages=self.compile_chat_messages(with_history, prompt),
                **args,
            )
            for chunk in generator:
                yield chunk.choices[0].message.content
        else:
            generator = openai.Completion.create(
                prompt=prompt,
                **args,
            )
            for chunk in generator:
                yield chunk.choices[0].text

    def complete(self, prompt: str, with_history: List[ChatMessage] = [], **kwargs) -> str:
        t1 = time.time()

        self.completion_count += 1
        args = {"model": self.default_model, "max_tokens": DEFAULT_MAX_TOKENS, "temperature": 0.5, "top_p": 1,
                "frequency_penalty": 0, "presence_penalty": 0, "stream": False} | kwargs

        if args["model"] in CHAT_MODELS:
            resp = openai.ChatCompletion.create(
                messages=self.compile_chat_messages(with_history, prompt),
                **args,
            ).choices[0].message.content
        else:
            resp = openai.Completion.create(
                prompt=prompt,
                **args,
            ).choices[0].text

        t2 = time.time()
        print("Completion time:", t2 - t1)
        return resp

    def edit(self, inp: str, instruction: str) -> str:
        try:
            resp = openai.Edit.create(
                input=inp,
                instruction=instruction,
                model='text-davinci-edit-001'
            ).choices[0].text
            return resp
        except Exception as e:
            print("OpenAI error:", e)
            raise e

    def parallel_edit(self, inputs: list[str], instructions: Union[List[str], str], **kwargs) -> list[str]:
        args = {"temperature": 0.5, "top_p": 1} | kwargs
        args['model'] = 'text-davinci-edit-001'

        async def fn():
            async with aiohttp.ClientSession() as session:
                tasks = []

                async def get(input, instruction):
                    async with session.post("https://api.openai.com/v1/edits", headers={
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + self.api_key
                    }, json={"model": args["model"], "input": input, "instruction": instruction, "temperature": args["temperature"], "max_tokens": args["max_tokens"], "suffix": args["suffix"]}) as resp:
                        json = await resp.json()
                        if "error" in json:
                            print("ERROR IN GPT-3 RESPONSE: ", json)
                            return None
                        return json["choices"][0]["text"]

                for i in range(len(inputs)):
                    tasks.append(get(inputs[i], instructions[i] if isinstance(
                        instructions, list) else instructions))

                return await asyncio.gather(*tasks)

        return asyncio.run(fn())

    def parallel_complete(self, prompts: list[str], suffixes: Union[list[str], None] = None, **kwargs) -> list[str]:
        self.completion_count += len(prompts)
        args = {"model": self.default_model, "max_tokens": DEFAULT_MAX_TOKENS, "temperature": 0.5,
                "top_p": 1, "frequency_penalty": 0, "presence_penalty": 0} | kwargs

        async def fn():
            async with aiohttp.ClientSession() as session:
                tasks = []

                async def get(prompt, suffix):
                    async with session.post("https://api.openai.com/v1/completions", headers={
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + self.api_key
                    }, json={"model": args["model"], "prompt": prompt, "temperature": args["temperature"], "max_tokens": args["max_tokens"], "suffix": suffix}) as resp:
                        json = await resp.json()
                        if "error" in json:
                            print("ERROR IN GPT-3 RESPONSE: ", json)
                            return None
                        return json["choices"][0]["text"]

                for i in range(len(prompts)):
                    tasks.append(asyncio.ensure_future(
                        get(prompts[i], suffixes[i] if suffixes else None)))

                return await asyncio.gather(*tasks)

        return asyncio.run(fn())
