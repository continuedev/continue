import os
from typing import Callable, Dict, List, Union

import chevron

from ...core.main import ChatMessage


def get_vars_in_template(template):
    """
    Get the variables in a template
    """
    return [
        token[1]
        for token in chevron.tokenizer.tokenize(template)
        if token[0] == "variable"
    ]


def escape_var(var: str) -> str:
    """
    Escape a variable so it can be used in a template
    """
    return var.replace(os.path.sep, "").replace(".", "")


def render_templated_string(template: str) -> str:
    """
    Render system message or other templated string with mustache syntax.
    Right now it only supports rendering absolute file paths as their contents.
    """
    vars = get_vars_in_template(template)

    args = {}
    for var in vars:
        if var.startswith(os.path.sep):
            # Escape vars which are filenames, because mustache doesn't allow / in variable names
            escaped_var = escape_var(var)
            template = template.replace(var, escaped_var)

            if os.path.exists(var) and os.path.isfile(var):
                args[escaped_var] = open(var, "r").read()
            else:
                args[escaped_var] = ""

    return chevron.render(template, args)


"""
A PromptTemplate can either be a template string (mustache syntax, e.g. {{user_input}}) or
a function which takes the history and a dictionary of additional key-value pairs and returns
either a string or a list of ChatMessages.
If a string is returned, it will be assumed that the chat history should be ignored
"""
PromptTemplate = Union[
    str, Callable[[List[ChatMessage], Dict[str, str]], Union[str, List[ChatMessage]]]
]


def render_prompt_template(
    template: PromptTemplate, history: List[ChatMessage], other_data: Dict[str, str]
) -> Union[str, List[ChatMessage]]:
    """
    Render a prompt template.
    """
    if isinstance(template, str):
        data = {
            "history": history,
            **other_data,
        }
        if len(history) > 0 and history[0].role == "system":
            data["system_message"] = history.pop(0).content

        return chevron.render(template, data)
    else:
        return template(history, other_data)
