import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# OpenAI

The OpenAI class can be used to access OpenAI models like gpt-4 and gpt-3.5-turbo.

If you are locally serving a model that uses an OpenAI-compatible server, you can simply change the `api_base` in the `OpenAI` class like this:

```python
from continuedev.src.continuedev.libs.llm.openai import OpenAI

config = ContinueConfig(
    ...
    models=Models(
        default=OpenAI(
            api_key="EMPTY",
            model="<MODEL_NAME>",
            api_base="http://localhost:8000", # change to your server
        )
    )
)
```

Options for serving models locally with an OpenAI-compatible server include:

- [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
- [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
- [LocalAI](https://localai.io/basics/getting_started/)
- [llama-cpp-python](https://github.com/abetlen/llama-cpp-python#web-server)

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/openai.py)

## Properties

<ClassPropertyRef name='api_base' details='{&quot;title&quot;: &quot;Api Base&quot;, &quot;description&quot;: &quot;OpenAI API base URL.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='api_type' details='{&quot;title&quot;: &quot;Api Type&quot;, &quot;description&quot;: &quot;OpenAI API type.&quot;, &quot;enum&quot;: [&quot;azure&quot;, &quot;openai&quot;], &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='api_version' details='{&quot;title&quot;: &quot;Api Version&quot;, &quot;description&quot;: &quot;OpenAI API version. For use with Azure OpenAI Service.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='engine' details='{&quot;title&quot;: &quot;Engine&quot;, &quot;description&quot;: &quot;OpenAI engine. For use with Azure OpenAI Service.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>


### Inherited Properties

<ClassPropertyRef name='model' details='{&quot;title&quot;: &quot;Model&quot;, &quot;description&quot;: &quot;The name of the model to be used (e.g. gpt-4, codellama)&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/>
<ClassPropertyRef name='api_key' details='{&quot;title&quot;: &quot;Api Key&quot;, &quot;description&quot;: &quot;OpenAI API key&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/>
<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;description&quot;: &quot;A title that will identify this model in the model selection dropdown&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='system_message' details='{&quot;title&quot;: &quot;System Message&quot;, &quot;description&quot;: &quot;A system message that will always be followed by the LLM&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='context_length' details='{&quot;title&quot;: &quot;Context Length&quot;, &quot;description&quot;: &quot;The maximum context length of the LLM in tokens, as counted by count_tokens.&quot;, &quot;default&quot;: 2048, &quot;type&quot;: &quot;integer&quot;}' required={false} default="2048"/>
<ClassPropertyRef name='unique_id' details='{&quot;title&quot;: &quot;Unique Id&quot;, &quot;description&quot;: &quot;The unique ID of the user.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='stop_tokens' details='{&quot;title&quot;: &quot;Stop Tokens&quot;, &quot;description&quot;: &quot;Tokens that will stop the completion.&quot;, &quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;type&quot;: &quot;string&quot;}}' required={false} default=""/>
<ClassPropertyRef name='timeout' details='{&quot;title&quot;: &quot;Timeout&quot;, &quot;description&quot;: &quot;Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.&quot;, &quot;default&quot;: 300, &quot;type&quot;: &quot;integer&quot;}' required={false} default="300"/>
<ClassPropertyRef name='verify_ssl' details='{&quot;title&quot;: &quot;Verify Ssl&quot;, &quot;description&quot;: &quot;Whether to verify SSL certificates for requests.&quot;, &quot;type&quot;: &quot;boolean&quot;}' required={false} default=""/>
<ClassPropertyRef name='ca_bundle_path' details='{&quot;title&quot;: &quot;Ca Bundle Path&quot;, &quot;description&quot;: &quot;Path to a custom CA bundle to use when making the HTTP request&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='proxy' details='{&quot;title&quot;: &quot;Proxy&quot;, &quot;description&quot;: &quot;Proxy URL to use for requests.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.&quot;, &quot;default&quot;: {}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{}"/>
