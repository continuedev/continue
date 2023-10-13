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
<ClassPropertyRef name='stop_tokens' details='{&quot;title&quot;: &quot;Stop Tokens&quot;, &quot;description&quot;: &quot;Tokens that will stop the completion.&quot;, &quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;type&quot;: &quot;string&quot;}}' required={false} default=""/>
<ClassPropertyRef name='temperature' details='{&quot;title&quot;: &quot;Temperature&quot;, &quot;description&quot;: &quot;The temperature of the completion.&quot;, &quot;type&quot;: &quot;number&quot;}' required={false} default=""/>
<ClassPropertyRef name='top_p' details='{&quot;title&quot;: &quot;Top P&quot;, &quot;description&quot;: &quot;The top_p of the completion.&quot;, &quot;type&quot;: &quot;number&quot;}' required={false} default=""/>
<ClassPropertyRef name='top_k' details='{&quot;title&quot;: &quot;Top K&quot;, &quot;description&quot;: &quot;The top_k of the completion.&quot;, &quot;type&quot;: &quot;integer&quot;}' required={false} default=""/>
<ClassPropertyRef name='presence_penalty' details='{&quot;title&quot;: &quot;Presence Penalty&quot;, &quot;description&quot;: &quot;The presence penalty Aof the completion.&quot;, &quot;type&quot;: &quot;number&quot;}' required={false} default=""/>
<ClassPropertyRef name='frequency_penalty' details='{&quot;title&quot;: &quot;Frequency Penalty&quot;, &quot;description&quot;: &quot;The frequency penalty of the completion.&quot;, &quot;type&quot;: &quot;number&quot;}' required={false} default=""/>
<ClassPropertyRef name='timeout' details='{&quot;title&quot;: &quot;Timeout&quot;, &quot;description&quot;: &quot;Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.&quot;, &quot;default&quot;: 300, &quot;type&quot;: &quot;integer&quot;}' required={false} default="300"/>
<ClassPropertyRef name='verify_ssl' details='{&quot;title&quot;: &quot;Verify Ssl&quot;, &quot;description&quot;: &quot;Whether to verify SSL certificates for requests.&quot;, &quot;type&quot;: &quot;boolean&quot;}' required={false} default=""/>
<ClassPropertyRef name='ca_bundle_path' details='{&quot;title&quot;: &quot;Ca Bundle Path&quot;, &quot;description&quot;: &quot;Path to a custom CA bundle to use when making the HTTP request&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='proxy' details='{&quot;title&quot;: &quot;Proxy&quot;, &quot;description&quot;: &quot;Proxy URL to use when making the HTTP request&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='headers' details='{&quot;title&quot;: &quot;Headers&quot;, &quot;description&quot;: &quot;Headers to use when making the HTTP request&quot;, &quot;type&quot;: &quot;object&quot;, &quot;additionalProperties&quot;: {&quot;type&quot;: &quot;string&quot;}}' required={false} default=""/>
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.&quot;, &quot;default&quot;: {&quot;edit&quot;: &quot;Consider the following code:\n```\n{{{code_to_edit}}}\n```\nEdit the code to perfectly satisfy the following user request:\n{{{user_input}}}\nOutput nothing except for the code. No code block, no English explanation, no start/end tags.&quot;}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{&#x27;edit&#x27;: &#x27;Consider the following code:\n```\n{{{code_to_edit}}}\n```\nEdit the code to perfectly satisfy the following user request:\n{{{user_input}}}\nOutput nothing except for the code. No code block, no English explanation, no start/end tags.&#x27;}"/>
