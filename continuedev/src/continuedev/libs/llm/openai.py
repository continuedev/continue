import asyncio
import time
from typing import Any, Dict, Generator, List, Union
import openai
import aiohttp
from ..llm import LLM
from pydantic import BaseModel, validator

DEFAULT_MAX_TOKENS = 2048


class OpenAI(LLM):
    api_key: str
    completion_count: int = 0
    default_model: str = "text-davinci-003"

    @validator("api_key", pre=True, always=True)
    def validate_api_key(cls, v):
        openai.api_key = v
        return v

    def with_system_message(self, system_message: Union[str, None]):
        return OpenAI(api_key=self.api_key, system_message=system_message)

    def stream_chat(self, messages, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        self.completion_count += 1
        args = {"max_tokens": DEFAULT_MAX_TOKENS, "temperature": 0.5, "top_p": 1,
                "frequency_penalty": 0, "presence_penalty": 0} | kwargs
        args["stream"] = True
        args["model"] = "gpt-3.5-turbo"

        for chunk in openai.ChatCompletion.create(
            messages=messages,
            **args,
        ):
            if "content" in chunk.choices[0].delta:
                yield chunk.choices[0].delta.content
            else:
                continue

    def stream_complete(self, prompt: str, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        self.completion_count += 1
        args = {"model": self.default_model, "max_tokens": DEFAULT_MAX_TOKENS, "temperature": 0.5,
                "top_p": 1, "frequency_penalty": 0, "presence_penalty": 0, "suffix": None} | kwargs
        args["stream"] = True

        if args["model"] == "gpt-3.5-turbo":
            generator = openai.ChatCompletion.create(
                messages=[{
                    "role": "user",
                    "content": prompt
                }],
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

    def complete(self, prompt: str, **kwargs) -> str:
        t1 = time.time()

        self.completion_count += 1
        args = {"model": self.default_model, "max_tokens": DEFAULT_MAX_TOKENS, "temperature": 0.5, "top_p": 1,
                "frequency_penalty": 0, "presence_penalty": 0, "stream": False} | kwargs

        if args["model"] == "gpt-3.5-turbo":
            messages = [{
                "role": "user",
                "content": prompt
            }]
            if self.system_message:
                messages.insert(0, {
                    "role": "system",
                    "content": self.system_message
                })
            resp = openai.ChatCompletion.create(
                messages=messages,
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
