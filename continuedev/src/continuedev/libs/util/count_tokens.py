import json
from typing import Dict, List, Union

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
DEFAULT_MAX_TOKENS = 1024
DEFAULT_ARGS = {
    "max_tokens": DEFAULT_MAX_TOKENS,
    "temperature": 0.5,
}

already_saw_import_err = False


def encoding_for_model(model_name: str):
    global already_saw_import_err
    if already_saw_import_err:
        return None
    
    try:
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


def count_tokens(model_name: str, text: Union[str, None]):
    if text is None:
        return 0
    encoding = encoding_for_model(model_name)
    if encoding is None:
        # Make a safe estimate given that tokens are usually typically ~4 characters on average
        return len(text) // 2
    return len(encoding.encode(text, disallowed_special=()))


def count_chat_message_tokens(model_name: str, chat_message: ChatMessage) -> int:
    # Doing simpler, safer version of what is here:
    # https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
    # every message follows <|start|>{role/name}\n{content}<|end|>\n
    TOKENS_PER_MESSAGE = 4
    return count_tokens(model_name, chat_message.content) + TOKENS_PER_MESSAGE


def prune_raw_prompt_from_top(
    model_name: str, context_length: int, prompt: str, tokens_for_completion: int
):
    max_tokens = context_length - tokens_for_completion
    encoding = encoding_for_model(model_name)

    if encoding is None:
        desired_length_in_chars = max_tokens * 2
        return prompt[-desired_length_in_chars:]

    tokens = encoding.encode(prompt, disallowed_special=())
    if len(tokens) <= max_tokens:
        return prompt
    else:
        return encoding.decode(tokens[-max_tokens:])


def prune_chat_history(
    model_name: str,
    chat_history: List[ChatMessage],
    context_length: int,
    tokens_for_completion: int,
):
    total_tokens = tokens_for_completion + sum(
        count_chat_message_tokens(model_name, message) for message in chat_history
    )

    # 1. Replace beyond last 5 messages with summary
    i = 0
    while total_tokens > context_length and i < len(chat_history) - 5:
        message = chat_history[0]
        total_tokens -= count_tokens(model_name, message.content)
        total_tokens += count_tokens(model_name, message.summary)
        message.content = message.summary
        i += 1

    # 2. Remove entire messages until the last 5
    while (
        len(chat_history) > 5
        and total_tokens > context_length
        and len(chat_history) > 0
    ):
        message = chat_history.pop(0)
        total_tokens -= count_tokens(model_name, message.content)

    # 3. Truncate message in the last 5, except last 1
    i = 0
    while (
        total_tokens > context_length
        and len(chat_history) > 0
        and i < len(chat_history) - 1
    ):
        message = chat_history[i]
        total_tokens -= count_tokens(model_name, message.content)
        total_tokens += count_tokens(model_name, message.summary)
        message.content = message.summary
        i += 1

    # 4. Remove entire messages in the last 5, except last 1
    while total_tokens > context_length and len(chat_history) > 1:
        message = chat_history.pop(0)
        total_tokens -= count_tokens(model_name, message.content)

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


def compile_chat_messages(
    model_name: str,
    msgs: Union[List[ChatMessage], None],
    context_length: int,
    max_tokens: int,
    prompt: Union[str, None] = None,
    functions: Union[List, None] = None,
    system_message: Union[str, None] = None,
) -> List[Dict]:
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
            function_tokens += count_tokens(model_name, json.dumps(function))

    if max_tokens + function_tokens + TOKEN_BUFFER_FOR_SAFETY >= context_length:
        raise ValueError(
            f"max_tokens ({max_tokens}) is too close to context_length ({context_length}), which doesn't leave room for chat history. This would cause incoherent responses. Try increasing the context_length parameter of the model in your config file."
        )

    msgs_copy = prune_chat_history(
        model_name,
        msgs_copy,
        context_length,
        function_tokens + max_tokens + TOKEN_BUFFER_FOR_SAFETY,
    )

    history = [msg.to_dict(with_functions=functions is not None) for msg in msgs_copy]

    # Move system message back to start
    if (
        system_message is not None
        and len(history) >= 2
        and history[-2]["role"] == "system"
    ):
        system_message_dict = history.pop(-2)
        history.insert(0, system_message_dict)

    return history


def format_chat_messages(messages: List[ChatMessage]) -> str:
    formatted = ""
    for msg in messages:
        formatted += f"<{msg['role'].capitalize()}>\n{msg['content']}\n\n"
    return formatted
