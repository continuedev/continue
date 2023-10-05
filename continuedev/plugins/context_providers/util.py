import re


def remove_meilisearch_disallowed_chars(id: str) -> str:
    return re.sub(r"[^0-9a-zA-Z_-]", "", id)
