from textwrap import dedent

from ....core.main import ChatMessage


def llama2_template_messages(msgs: ChatMessage) -> str:
    if len(msgs) == 0:
        return ""

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
            prompt += msgs[i]["content"]

    return prompt


def code_llama_template_messages(msgs: ChatMessage) -> str:
    return f"[INST] {msgs[-1]['content']}\n[/INST]"


def extra_space_template_messages(msgs: ChatMessage) -> str:
    return f" {msgs[-1]['content']}"


def code_llama_python_template_messages(msgs: ChatMessage) -> str:
    return dedent(
        f"""\
        [INST]
        You are an expert Python programmer and personal assistant, here is your task: {msgs[-1]['content']}
        Your answer should start with a [PYTHON] tag and end with a [/PYTHON] tag.
        [/INST]"""
    )
