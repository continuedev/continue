import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# QueuedLLM

QueuedLLM exists to make up for LLM servers that cannot handle multiple requests at once. It uses a lock to ensure that only one request is being processed at a time.

If you are already using another LLM class and are experiencing this problem, you can just wrap it with the QueuedLLM class like this:

```python
from continuedev.src.continuedev.libs.llm.queued import QueuedLLM

config = ContinueConfig(
    ...
    models=Models(
        default=QueuedLLM(llm=<OTHER_LLM_CLASS>)
    )
)
```

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/queued.py)

## Properties

<ClassPropertyRef name='llm' details='{&quot;title&quot;: &quot;Llm&quot;, &quot;description&quot;: &quot;The LLM to wrap with a lock&quot;, &quot;allOf&quot;: [{&quot;$ref&quot;: &quot;#/definitions/LLM&quot;}]}' required={true} default=""/>


### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;description&quot;: &quot;A title that will identify this model in the model selection dropdown&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='system_message' details='{&quot;title&quot;: &quot;System Message&quot;, &quot;description&quot;: &quot;A system message that will always be followed by the LLM&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='context_length' details='{&quot;title&quot;: &quot;Context Length&quot;, &quot;description&quot;: &quot;The maximum context length of the LLM in tokens, as counted by count_tokens.&quot;, &quot;default&quot;: 2048, &quot;type&quot;: &quot;integer&quot;}' required={false} default="2048"/>
<ClassPropertyRef name='unique_id' details='{&quot;title&quot;: &quot;Unique Id&quot;, &quot;description&quot;: &quot;The unique ID of the user.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='model' details='{&quot;title&quot;: &quot;Model&quot;, &quot;description&quot;: &quot;The name of the model to be used (e.g. gpt-4, codellama)&quot;, &quot;default&quot;: &quot;queued&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="queued"/>
<ClassPropertyRef name='stop_tokens' details='{&quot;title&quot;: &quot;Stop Tokens&quot;, &quot;description&quot;: &quot;Tokens that will stop the completion.&quot;, &quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;type&quot;: &quot;string&quot;}}' required={false} default=""/>
<ClassPropertyRef name='timeout' details='{&quot;title&quot;: &quot;Timeout&quot;, &quot;description&quot;: &quot;Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.&quot;, &quot;default&quot;: 300, &quot;type&quot;: &quot;integer&quot;}' required={false} default="300"/>
<ClassPropertyRef name='verify_ssl' details='{&quot;title&quot;: &quot;Verify Ssl&quot;, &quot;description&quot;: &quot;Whether to verify SSL certificates for requests.&quot;, &quot;type&quot;: &quot;boolean&quot;}' required={false} default=""/>
<ClassPropertyRef name='ca_bundle_path' details='{&quot;title&quot;: &quot;Ca Bundle Path&quot;, &quot;description&quot;: &quot;Path to a custom CA bundle to use when making the HTTP request&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='proxy' details='{&quot;title&quot;: &quot;Proxy&quot;, &quot;description&quot;: &quot;Proxy URL to use when making the HTTP request&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.&quot;, &quot;default&quot;: {}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{}"/>
<ClassPropertyRef name='api_key' details='{&quot;title&quot;: &quot;Api Key&quot;, &quot;description&quot;: &quot;The API key for the LLM provider.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
