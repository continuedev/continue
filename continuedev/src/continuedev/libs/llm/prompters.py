from typing import Any, Callable, List, Tuple, Union
from ..llm import LLM
from .openai import OpenAI


def cls_method_to_str(cls_name: str, init: str, method: str) -> str:
    """Convert class and method info to formatted code"""
    return f"""class {cls_name}:
{init}
{method}"""


# Prompter classes
class Prompter:
    def __init__(self, llm: LLM = None):
        if llm is None:
            self.llm = OpenAI()
        else:
            self.llm = llm

    def _compile_prompt(self, inp: Any) -> Tuple[str, str, Union[str, None]]:
        "Takes input and returns prompt, prefix, suffix"
        raise NotImplementedError

    def complete(self, inp: Any, **kwargs) -> str:
        prompt, prefix, suffix = self._compile_prompt(inp)
        resp = self.llm.complete(prompt + prefix, suffix=suffix, **kwargs)
        return prefix + resp + (suffix or "")

    def __call__(self, inp: Any, **kwargs) -> str:
        return self.complete(inp, **kwargs)

    def parallel_complete(self, inps: List[Any]) -> List[str]:
        prompts = []
        prefixes = []
        suffixes = []
        for inp in inps:
            prompt, prefix, suffix = self._compile_prompt(inp)
            prompts.append(prompt)
            prefixes.append(prefix)
            suffixes.append(suffix)

        resps = self.llm.parallel_complete(
            [prompt + prefix for prompt, prefix in zip(prompts, prefixes)], suffixes=suffixes)
        return [prefix + resp + (suffix or "") for prefix, resp, suffix in zip(prefixes, resps, suffixes)]


class MixedPrompter(Prompter):
    def __init__(self, prompters: List[Prompter], router: Callable[[Any], int], llm: LLM = None):
        super().__init__(llm=llm)
        self.prompters = prompters
        self.router = router

    def _compile_prompt(self, inp: Any) -> Tuple[str, str, Union[str, None]]:
        prompter = self.prompters[self.router(inp)]
        return prompter._compile_prompt(inp)

    def complete(self, inp: Any, **kwargs) -> str:
        prompter = self.prompters[self.router(inp)]
        return prompter.complete(inp, **kwargs)


class SimplePrompter(Prompter):
    def __init__(self, prompt_fn: Callable[[Any], str], llm: LLM = None):
        super().__init__(llm=llm)
        self.prompt_fn = prompt_fn

    def _compile_prompt(self, inp: Any) -> Tuple[str, str, Union[str, None]]:
        return self.prompt_fn(inp), "", None


class FormatStringPrompter(SimplePrompter):
    """Pass a formatted string, and the input should be a dict with the keys to format"""

    def __init__(self, prompt: str, llm: LLM = None):
        super().__init__(lambda inp: prompt.format(**inp), llm=llm)


class BasicCommentPrompter(SimplePrompter):
    def __init__(self, comment: str, llm: LLM = None):
        super().__init__(lambda inp: f"""{inp}

# {comment}""", llm=llm)


class EditPrompter(Prompter):
    def __init__(self, prompt_fn: Callable[[Any], Tuple[str, str]], llm: LLM = None):
        super().__init__(llm=llm)
        self.prompt_fn = prompt_fn

    def complete(self, inp: str, **kwargs) -> str:
        inp, instruction = self.prompt_fn(inp)
        return self.llm.edit(inp, instruction, **kwargs)

    def parallel_complete(self, inps: List[Any]) -> List[str]:
        prompts = []
        instructions = []
        for inp in inps:
            prompt, instruction = self.prompt_fn(inp)
            prompts.append(prompt)
            instructions.append(instruction)

        return self.llm.parallel_edit(prompts, instructions)


class InsertPrompter(Prompter):
    def __init__(self, prompt_fn: Callable[[Any], Tuple[str, str, str]], llm: LLM = None):
        super().__init__(llm=llm)
        self.prompt_fn = prompt_fn

    def _compile_prompt(self, inp: Any) -> Tuple[str, str, Union[str, None]]:
        return self.prompt_fn(inp)
