import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# ReplicateLLM

Replicate is a great option for newly released language models or models that you've deployed through their platform. Sign up for an account [here](https://replicate.ai/), copy your API key, and then select any model from the [Replicate Streaming List](https://replicate.com/collections/streaming-language-models). Change `~/.continue/config.py` to look like this:

```python title="~/.continue/config.py"
from continuedev.core.models import Models
from continuedev.libs.llm.replicate import ReplicateLLM

config = ContinueConfig(
    ...
    models=Models(
        default=ReplicateLLM(
            model="replicate/codellama-13b-instruct:da5676342de1a5a335b848383af297f592b816b950a43d251a0a9edd0113604b",
            api_key="my-replicate-api-key")
    )
)
```

If you don't specify the `model` parameter, it will default to `replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781`.

[View the source](https://github.com/continuedev/continue/blob/main/server/continuedev/libs/llm/replicate.py)

## Properties



### Inherited Properties

<ClassPropertyRef name='api_key' details='{&quot;title&quot;: &quot;Api Key&quot;, &quot;description&quot;: &quot;Replicate API key&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/>
<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;description&quot;: &quot;A title that will identify this model in the model selection dropdown&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='unique_id' details='{&quot;title&quot;: &quot;Unique Id&quot;, &quot;description&quot;: &quot;The unique ID of the user.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='model' details='{&quot;title&quot;: &quot;Model&quot;, &quot;description&quot;: &quot;The name of the model to be used (e.g. gpt-4, codellama)&quot;, &quot;default&quot;: &quot;replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781"/>
<ClassPropertyRef name='system_message' details='{&quot;title&quot;: &quot;System Message&quot;, &quot;description&quot;: &quot;A system message that will always be followed by the LLM&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='context_length' details='{&quot;title&quot;: &quot;Context Length&quot;, &quot;description&quot;: &quot;The maximum context length of the LLM in tokens, as counted by count_tokens.&quot;, &quot;default&quot;: 2048, &quot;type&quot;: &quot;integer&quot;}' required={false} default="2048"/>
<ClassPropertyRef name='completion_options' details='{&quot;title&quot;: &quot;Completion Options&quot;, &quot;description&quot;: &quot;Options for the completion endpoint. Read more about the completion options in the documentation.&quot;, &quot;default&quot;: {&quot;temperature&quot;: null, &quot;top_p&quot;: null, &quot;top_k&quot;: null, &quot;presence_penalty&quot;: null, &quot;frequency_penalty&quot;: null, &quot;stop&quot;: null, &quot;max_tokens&quot;: 600}, &quot;allOf&quot;: [{&quot;$ref&quot;: &quot;#/definitions/BaseCompletionOptions&quot;}]}' required={false} default="{&#x27;temperature&#x27;: None, &#x27;top_p&#x27;: None, &#x27;top_k&#x27;: None, &#x27;presence_penalty&#x27;: None, &#x27;frequency_penalty&#x27;: None, &#x27;stop&#x27;: None, &#x27;max_tokens&#x27;: 600}"/>
<ClassPropertyRef name='request_options' details='{&quot;title&quot;: &quot;Request Options&quot;, &quot;description&quot;: &quot;Options for the HTTP request to the LLM.&quot;, &quot;default&quot;: {&quot;timeout&quot;: 300, &quot;verify_ssl&quot;: null, &quot;ca_bundle_path&quot;: null, &quot;proxy&quot;: null, &quot;headers&quot;: null}, &quot;allOf&quot;: [{&quot;$ref&quot;: &quot;#/definitions/RequestOptions&quot;}]}' required={false} default="{&#x27;timeout&#x27;: 300, &#x27;verify_ssl&#x27;: None, &#x27;ca_bundle_path&#x27;: None, &#x27;proxy&#x27;: None, &#x27;headers&#x27;: None}"/>
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.&quot;, &quot;default&quot;: {}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{}"/>
<ClassPropertyRef name='api_base' details='{&quot;title&quot;: &quot;Api Base&quot;, &quot;description&quot;: &quot;The base URL of the LLM API.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
