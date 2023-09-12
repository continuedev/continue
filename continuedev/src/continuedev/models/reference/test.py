import importlib
import json
from textwrap import dedent  # noqa: F401

LLM_MODULES = [
    ("openai", "OpenAI"),
    ("anthropic", "AnthropicLLM"),
    ("ggml", "GGML"),
    ("llamacpp", "LlamaCpp"),
    ("text_gen_interface", "TextGenUI"),
    ("ollama", "Ollama"),
    ("queued", "QueuedLLM"),
    ("replicate", "ReplicateLLM"),
    ("together", "TogetherLLM"),
]


def import_llm_module(module_name, module_title):
    module_name = f"continuedev.src.continuedev.libs.llm.{module_name}"
    module = importlib.import_module(module_name)
    obj = getattr(module, module_title)
    return obj


def llm_docs_from_schema(schema, filename):
    # Generate markdown docs
    markdown_docs = dedent(
        f"""\
import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# {schema['title']}

{dedent(schema.get("description", ""))}

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/{filename}.py)

## Properties

"""
    )

    for prop, details in schema["properties"].items():
        required = prop in schema.get("required", [])
        if not required:
            continue
        required = "true" if required else "false"
        markdown_docs += f"<ClassPropertyRef name='{prop}' details='{json.dumps(details)}' required={{{required}}}/>"

    for prop, details in schema["properties"].items():
        required = prop in schema.get("required", [])
        if required:
            continue
        required = "true" if required else "false"
        markdown_docs += f"<ClassPropertyRef name='{prop}' details='{json.dumps(details)}' required={{{required}}}/>"

    return markdown_docs


for module_name, module_title in LLM_MODULES:
    obj = import_llm_module(module_name, module_title)
    schema = obj.schema()
    markdown_docs = llm_docs_from_schema(schema, module_name)
    with open(f"docs/docs/reference/Models/{module_name}.md", "w") as f:
        f.write(markdown_docs)
