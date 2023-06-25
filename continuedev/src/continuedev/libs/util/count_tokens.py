from typing import Dict, List, Union
from ...core.main import ChatMessage
import tiktoken

aliases = {}
DEFAULT_MAX_TOKENS = 2048
MAX_TOKENS_FOR_MODEL = {
    "gpt-3.5-turbo": 4096 - DEFAULT_MAX_TOKENS,
    "gpt-3.5-turbo-0613": 4096 - DEFAULT_MAX_TOKENS,
    "gpt-3.5-turbo-16k": 16384 - DEFAULT_MAX_TOKENS,
    "gpt-4": 8192 - DEFAULT_MAX_TOKENS
}
CHAT_MODELS = {
    "gpt-3.5-turbo", "gpt-3.5-turbo-16k", "gpt-4", "gpt-3.5-turbo-0613"
}
DEFAULT_ARGS = {"max_tokens": DEFAULT_MAX_TOKENS, "temperature": 0.5, "top_p": 1,
                "frequency_penalty": 0, "presence_penalty": 0}


def encoding_for_model(model: str):
    return tiktoken.encoding_for_model(aliases.get(model, model))


def count_tokens(model: str, text: str | None):
    if text is None:
        return 0
    encoding = encoding_for_model(model)
    return len(encoding.encode(text, disallowed_special=()))


def prune_chat_history(model: str, chat_history: List[ChatMessage], max_tokens: int, tokens_for_completion: int):
    total_tokens = tokens_for_completion + \
        sum(count_tokens(model, message.content)
            for message in chat_history)

    # 1. Replace beyond last 5 messages with summary
    i = 0
    while total_tokens > max_tokens and i < len(chat_history) - 5:
        message = chat_history[0]
        total_tokens -= count_tokens(model, message.content)
        total_tokens += count_tokens(model, message.summary)
        message.content = message.summary
        i += 1

    # 2. Remove entire messages until the last 5
    while len(chat_history) > 5 and total_tokens > max_tokens:
        message = chat_history.pop(0)
        total_tokens -= count_tokens(model, message.content)

    # 3. Truncate message in the last 5
    i = 0
    while total_tokens > max_tokens:
        message = chat_history[0]
        total_tokens -= count_tokens(model, message.content)
        total_tokens += count_tokens(model, message.summary)
        message.content = message.summary
        i += 1

    # 4. Remove entire messages in the last 5
    while total_tokens > max_tokens and len(chat_history) > 0:
        message = chat_history.pop(0)
        total_tokens -= count_tokens(model, message.content)

    return chat_history


def compile_chat_messages(model: str, msgs: List[ChatMessage], prompt: str | None = None, with_functions: bool = False, system_message: Union[str, None] = None) -> List[Dict]:
    prompt_tokens = count_tokens(model, prompt)
    msgs = prune_chat_history(model,
                              msgs, MAX_TOKENS_FOR_MODEL[model], prompt_tokens + 1000 + count_tokens(model, system_message))
    history = []
    if system_message:
        history.append({
            "role": "system",
            "content": system_message
        })
    history += [msg.to_dict(with_functions=with_functions) for msg in msgs]
    if prompt:
        history.append({
            "role": "user",
            "content": prompt
        })

    return history
