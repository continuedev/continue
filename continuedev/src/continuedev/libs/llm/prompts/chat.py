from textwrap import dedent
from typing import Dict, List

from anthropic import AI_PROMPT, HUMAN_PROMPT


def anthropic_template_messages(messages: List[Dict[str, str]]) -> str:
    prompt = ""

    # Anthropic prompt must start with a Human turn
    if (
        len(messages) > 0
        and messages[0]["role"] != "user"
        and messages[0]["role"] != "system"
    ):
        prompt += f"{HUMAN_PROMPT} Hello."
    for msg in messages:
        prompt += f"{HUMAN_PROMPT if (msg['role'] == 'user' or msg['role'] == 'system') else AI_PROMPT} {msg['content']} "

    prompt += AI_PROMPT
    return prompt


def template_alpaca_messages(msgs: List[Dict[str, str]]) -> str:
    prompt = ""

    if msgs[0]["role"] == "system":
        prompt += f"{msgs[0]['content']}\n"
        msgs.pop(0)

    prompt += "### Instruction:\n"
    for msg in msgs:
        prompt += f"{msg['content']}\n"

    prompt += "### Response:\n"

    return prompt


def llama2_template_messages(msgs: List[Dict[str, str]]) -> str:
    if len(msgs) == 0:
        return ""

    if msgs[0]["role"] == "assistant":
        # These models aren't trained to handle assistant message coming first,
        # and typically these are just introduction messages from Continue
        msgs.pop(0)

    prompt = ""
    has_system = msgs[0]["role"] == "system"

    if has_system and msgs[0]["content"].strip() == "":
        has_system = False
        msgs = msgs[1:]

    if has_system:
        system_message = dedent(
            f"""\
                <<SYS>>
                {msgs[0]["content"]}
                <</SYS>>
                
                """
        )
        if len(msgs) > 1:
            prompt += f"[INST] {system_message}{msgs[1]['content']} [/INST]"
        else:
            prompt += f"[INST] {system_message} [/INST]"
            return

    for i in range(2 if has_system else 0, len(msgs)):
        if msgs[i]["role"] == "user":
            prompt += f"[INST] {msgs[i]['content']} [/INST]"
        else:
            prompt += msgs[i]["content"] + " "

    return prompt


def code_llama_template_messages(msgs: List[Dict[str, str]]) -> str:
    return f"[INST] {msgs[-1]['content']}\n[/INST]"


def extra_space_template_messages(msgs: List[Dict[str, str]]) -> str:
    return f" {msgs[-1]['content']}"


def code_llama_python_template_messages(msgs: List[Dict[str, str]]) -> str:
    return dedent(
        f"""\
        [INST]
        You are an expert Python programmer and personal assistant, here is your task: {msgs[-1]['content']}
        Your answer should start with a [PYTHON] tag and end with a [/PYTHON] tag.
        [/INST]"""
    )
