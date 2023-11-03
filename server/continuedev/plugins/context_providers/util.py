import re


def remove_meilisearch_disallowed_chars(id: str) -> str:
    return re.sub(r"[^0-9a-zA-Z_-]", "", id)


def remove_prefix(text: str, prefix: str) -> str:
    if text.startswith(prefix):
        return text[len(prefix):]
    return text


def remove_suffix(text: str, suffix: str) -> str:
    if text.endswith(suffix):
        return text[:-len(suffix)]
    return text
