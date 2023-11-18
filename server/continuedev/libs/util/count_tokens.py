import json
import os
import sys
from typing import List, Optional, Union

from ...core.main import ChatMessage
from .templating import render_templated_string

# TODO move many of these into specific LLM.properties() function that
# contains max tokens, if its a chat model or not, default args (not all models
# want to be run at 0.5 temp). also lets custom models made for long contexts
# exist here (likg LLongMA)
aliases = {
    "ggml": "gpt-3.5-turbo",
    "claude-2": "gpt-3.5-turbo",
}
DEFAULT_MAX_TOKENS = 1000
DEFAULT_ARGS = {
    "max_tokens": DEFAULT_MAX_TOKENS,
    "temperature": 0.5,
}

CONTEXT_LENGTH_FOR_MODEL = {
    "gpt-3.5-turbo": 4096,
    "gpt-3.5-turbo-0613": 4096,
    "gpt-3.5-turbo-16k": 16_384,
    "gpt-4": 8192,
    "gpt-35-turbo-16k": 16_384,
    "gpt-35-turbo-0613": 4096,
    "gpt-35-turbo": 4096,
    "gpt-4-32k": 32_768,
    "gpt-4-1106-preview": 128_000,
}

already_saw_import_err = False


already_saw_import_err = False


def encoding_for_model(model_name: str):
    global already_saw_import_err
    if already_saw_import_err:
        return None

    try:
        if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
            tiktoken_cache = os.path.join(sys._MEIPASS, "tiktoken_cache")  # type: ignore
            if os.path.exists(tiktoken_cache):
                os.environ["TIKTOKEN_CACHE_DIR"] = tiktoken_cache

        import tiktoken
        from tiktoken_ext import openai_public  # noqa: F401

        try:
            return tiktoken.encoding_for_model(aliases.get(model_name, model_name))
        except Exception as _:
            return tiktoken.encoding_for_model("gpt-3.5-turbo")
    except Exception as e:
        print("Error importing tiktoken", e)
        already_saw_import_err = True
        return None


def count_tokens(text: Optional[str], model_name: Optional[str] = "gpt-4"):
    if text is None:
        return 0
    encoding = encoding_for_model(model_name or "gpt-4")
    if encoding is None:
        # Make a safe estimate given that tokens are usually typically ~4 characters on average
        return len(text) // 2
    return len(encoding.encode(text, disallowed_special=()))


def count_chat_message_tokens(model_name: str, chat_message: ChatMessage) -> int:
    # Doing simpler, safer version of what is here:
    # https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
    # every message follows <|start|>{role/name}\n{content}<|end|>\n
    TOKENS_PER_MESSAGE = 4
    return count_tokens(chat_message.content, model_name) + TOKENS_PER_MESSAGE


def prune_string_from_top(model_name: str, max_tokens: int, prompt: str):
    encoding = encoding_for_model(model_name)

    if encoding is None:
        desired_length_in_chars = max_tokens * 2
        return prompt[-desired_length_in_chars:]

    tokens = encoding.encode(prompt, disallowed_special=())
    if len(tokens) <= max_tokens:
        return prompt

    return encoding.decode(tokens[-max_tokens:])


def prune_string_from_bottom(model_name: str, max_tokens: int, prompt: str):
    encoding = encoding_for_model(model_name)

    if encoding is None:
        desired_length_in_chars = max_tokens * 2
        return prompt[:desired_length_in_chars]

    tokens = encoding.encode(prompt, disallowed_special=())
    if len(tokens) <= max_tokens:
        return prompt

    return encoding.decode(tokens[:max_tokens])


def prune_raw_prompt_from_top(
    model_name: str, context_length: int, prompt: str, tokens_for_completion: int
):
    max_tokens = context_length - tokens_for_completion - TOKEN_BUFFER_FOR_SAFETY
    return prune_string_from_top(model_name, max_tokens, prompt)


def prune_chat_history(
    model_name: str,
    chat_history: List[ChatMessage],
    context_length: int,
    tokens_for_completion: int,
):
    total_tokens = tokens_for_completion + sum(
        count_chat_message_tokens(model_name, message) for message in chat_history
    )

    # 0. Prune any messages that take up more than 1/3 of the context length
    longest_messages = sorted(
        chat_history, key=lambda message: len(message.content), reverse=True
    )
    longer_than_one_third = [
        message
        for message in longest_messages
        if count_tokens(message.content, model_name) > context_length / 3
    ]
    distance_from_third = [
        count_tokens(message.content, model_name) - context_length / 3
        for message in longer_than_one_third
    ]

    for i in range(len(longer_than_one_third)):
        # Prune line-by-line
        message = longer_than_one_third[i]
        lines = message.content.split("\n")
        tokens_removed = 0
        while (
            tokens_removed < distance_from_third[i]
            and total_tokens > context_length
            and len(lines) > 0
        ):
            delta = count_tokens("\n" + lines.pop(-1), model_name)
            tokens_removed += delta
            total_tokens -= delta

        message.content = "\n".join(lines)

    # 1. Replace beyond last 5 messages with summary
    i = 0
    while total_tokens > context_length and i < len(chat_history) - 5:
        message = chat_history[0]
        total_tokens -= count_tokens(message.content, model_name)
        total_tokens += count_tokens(message.summary, model_name)
        message.content = message.summary
        i += 1

    # 2. Remove entire messages until the last 5
    while (
        len(chat_history) > 5
        and total_tokens > context_length
        and len(chat_history) > 0
    ):
        message = chat_history.pop(0)
        total_tokens -= count_tokens(message.content, model_name)

    # 3. Truncate message in the last 5, except last 1
    i = 0
    while (
        total_tokens > context_length
        and len(chat_history) > 0
        and i < len(chat_history) - 1
    ):
        message = chat_history[i]
        total_tokens -= count_tokens(message.content, model_name)
        total_tokens += count_tokens(message.summary, model_name)
        message.content = message.summary
        i += 1

    # 4. Remove entire messages in the last 5, except last 1
    while total_tokens > context_length and len(chat_history) > 1:
        message = chat_history.pop(0)
        total_tokens -= count_tokens(message.content, model_name)

    # 5. Truncate last message
    if total_tokens > context_length and len(chat_history) > 0:
        message = chat_history[0]
        message.content = prune_raw_prompt_from_top(
            model_name, context_length, message.content, tokens_for_completion
        )
        total_tokens = context_length

    return chat_history


# In case we've missed weird edge cases
TOKEN_BUFFER_FOR_SAFETY = 100


def flatten_messages(msgs: List[ChatMessage]) -> List[ChatMessage]:
    """If there are multiple adjacent messages with same "role", combine them"""
    flattened = []
    for msg in msgs:
        if len(flattened) > 0 and flattened[-1].role == msg.role:
            flattened[-1].content += "\n\n" + (msg.content or "")
        else:
            flattened.append(msg)

    return flattened


def compile_chat_messages(
    model_name: str,
    msgs: Union[List[ChatMessage], None],
    context_length: int,
    max_tokens: int,
    prompt: Union[str, None] = None,
    functions: Union[List, None] = None,
    system_message: Union[str, None] = None,
) -> List[ChatMessage]:
    """
    The total number of tokens is system_message + sum(msgs) + functions + prompt after it is converted to a message
    """

    msgs_copy = [msg.copy(deep=True) for msg in msgs] if msgs is not None else []

    if prompt is not None:
        prompt_msg = ChatMessage(role="user", content=prompt, summary=prompt)
        msgs_copy += [prompt_msg]

    if system_message is not None and system_message.strip() != "":
        # NOTE: System message takes second precedence to user prompt, so it is placed just before
        # but move back to start after processing
        rendered_system_message = render_templated_string(system_message)
        system_chat_msg = ChatMessage(
            role="system",
            content=rendered_system_message,
            summary=rendered_system_message,
        )
        # insert at second-to-last position
        msgs_copy.insert(-1, system_chat_msg)

    # Add tokens from functions
    function_tokens = 0
    if functions is not None:
        for function in functions:
            function_tokens += count_tokens(json.dumps(function), model_name)

    if max_tokens + function_tokens + TOKEN_BUFFER_FOR_SAFETY >= context_length:
        raise ValueError(
            f"max_tokens ({max_tokens}) is too close to context_length ({context_length}), which doesn't leave room for chat history. This would cause incoherent responses. Try increasing the context_length parameter of the model in your config file."
        )

    history = prune_chat_history(
        model_name,
        msgs_copy,
        context_length,
        function_tokens + max_tokens + TOKEN_BUFFER_FOR_SAFETY,
    )

    # Move system message back to start
    if (
        system_message is not None
        and len(history) >= 2
        and history[-2].role == "system"
    ):
        moved_system_message = history.pop(-2)
        history.insert(0, moved_system_message)

    history = flatten_messages(history)

    return history


def format_chat_messages(messages: List[ChatMessage]) -> str:
    formatted = ""
    for msg in messages:
        formatted += f"<{msg.role.capitalize()}>\n{msg.content or ''}\n\n"
    return formatted
