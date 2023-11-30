import html
import importlib
import json
from textwrap import dedent

LLM_MODULES = [
    ("openai", "OpenAI"),
    ("anthropic", "AnthropicLLM"),
    ("ggml", "GGML"),
    ("llamacpp", "LlamaCpp"),
    ("text_gen_webui", "TextGenWebUI"),
    ("ollama", "Ollama"),
    ("replicate", "ReplicateLLM"),
    ("together", "TogetherLLM"),
    ("hf_inference_api", "HuggingFaceInferenceAPI"),
    ("hf_tgi", "HuggingFaceTGI"),
    ("openai_free_trial", "OpenAIFreeTrial"),
    ("google_palm_api", "GooglePaLMAPI"),
    ("queued", "QueuedLLM"),
]

CONTEXT_PROVIDER_MODULES = [
    ("diff", "DiffContextProvider"),
    ("file", "FileContextProvider"),
    ("filetree", "FileTreeContextProvider"),
    ("github", "GitHubIssuesContextProvider"),
    ("google", "GoogleContextProvider"),
    ("search", "SearchContextProvider"),
    ("terminal", "TerminalContextProvider"),
    ("url", "URLContextProvider"),
]


def import_llm_module(module_name, module_title):
    module_name = f"continuedev.libs.llm.{module_name}"
    module = importlib.import_module(module_name)
    obj = getattr(module, module_title)
    return obj


def import_context_provider_module(module_name, module_title):
    module_name = f"continuedev.plugins.context_providers.{module_name}"
    module = importlib.import_module(module_name)
    obj = getattr(module, module_title)
    return obj


def docs_from_schema(schema, filepath, ignore_properties=[], inherited=[]):
    # Generate markdown docs
    properties = ""
    inherited_properties = ""

    def add_property(prop, details, only_required):
        required = prop in schema.get("required", [])
        if only_required != required or prop in ignore_properties:
            return ""
        required = "true" if required else "false"
        return f"""<ClassPropertyRef name='{prop}' details='{html.escape(json.dumps(details))}' required={{{required}}} default="{html.escape(str(details.get("default", "")))}"/>\n"""

    for prop, details in schema["properties"].items():
        property = add_property(prop, details, True)
        if prop in inherited:
            inherited_properties += property
        else:
            properties += property

    for prop, details in schema["properties"].items():
        property = add_property(prop, details, False)
        if prop in inherited:
            inherited_properties += property
        else:
            properties += property

    return dedent(
        f"""\
import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# {schema['title']}

{dedent(schema.get("description", ""))}

[View the source](https://github.com/continuedev/continue/blob/main/server/continuedev/{filepath})

## Properties

{properties}

{"### Inherited Properties" if inherited_properties else ""}

{inherited_properties}"""
    )


llm_module = importlib.import_module("continuedev.libs.llm.base")
ctx_obj = getattr(llm_module, "LLM")
schema = ctx_obj.schema()
ctx_properties = schema["properties"].keys()

for module_name, module_title in LLM_MODULES:
    obj = import_llm_module(module_name, module_title)
    schema = obj.schema()
    markdown_docs = docs_from_schema(
        schema, f"libs/llm/{module_name}.py", inherited=ctx_properties
    )
    with open(f"docs/docs/reference/Models/{module_title.lower()}.md", "w") as f:
        f.write(markdown_docs)

# SerializedContinueConfig
config_module = importlib.import_module("continuedev.core.config")
config_obj = getattr(config_module, "SerializedContinueConfig")
schema = config_obj.schema()
schema["title"] = "Configuration Options"
markdown_docs = docs_from_schema(schema, "core/config.py")
with open("docs/docs/reference/config.md", "w") as f:
    f.write(markdown_docs)

ctx_module = importlib.import_module("continuedev.core.context")
ctx_obj = getattr(ctx_module, "ContextProvider")
schema = ctx_obj.schema()
ctx_properties = schema["properties"].keys()
for module_name, module_title in CONTEXT_PROVIDER_MODULES:
    obj = import_context_provider_module(module_name, module_title)
    schema = obj.schema()
    markdown_docs = docs_from_schema(
        schema,
        f"plugins/context_providers/{module_name}.py",
        ignore_properties=[
            "sdk",
            "updated_documents",
            "delete_documents",
            "selected_items",
            "ignore_patterns",
        ],
        inherited=ctx_properties,
    )
    with open(
        f"docs/docs/reference/Context Providers/{module_title.lower()}.md", "w"
    ) as f:
        f.write(markdown_docs)

# sdk_module = importlib.import_module("continuedev.core.sdk")
# sdk_obj = getattr(sdk_module, "ContinueSDK")
# schema = sdk_obj.schema()
# markdown_docs = docs_from_schema(schema, "sdk", ignore_properties=[])
# with open("docs/docs/reference/ContinueSDK.md", "w") as f:
#     f.write(markdown_docs)
