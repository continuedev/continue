import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# TogetherLLM

The Together API is a cloud platform for running large AI models. You can sign up [here](https://api.together.xyz/signup), copy your API key on the initial welcome screen, and then hit the play button on any model from the [Together Models list](https://docs.together.ai/docs/models-inference). Change `~/.continue/config.py` to look like this:

```python title="~/.continue/config.py"
from continuedev.core.models import Models
from continuedev.libs.llm.together import TogetherLLM

config = ContinueConfig(
    ...
    models=Models(
        default=TogetherLLM(
            api_key="<API_KEY>",
            model="togethercomputer/llama-2-13b-chat"
        )
    )
)
```

[View the source](https://github.com/continuedev/continue/blob/main/server/continuedev/libs/llm/libs/llm/together.py)

## Properties

<ClassPropertyRef name='base_url' details='{&quot;title&quot;: &quot;Base Url&quot;, &quot;description&quot;: &quot;The base URL for your Together API instance&quot;, &quot;default&quot;: &quot;https://api.together.xyz&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="https://api.together.xyz"/>


### Inherited Properties

<ClassPropertyRef name='api_key' details='{&quot;title&quot;: &quot;Api Key&quot;, &quot;description&quot;: &quot;Together API key&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/>
<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;description&quot;: &quot;A title that will identify this model in the model selection dropdown&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='unique_id' details='{&quot;title&quot;: &quot;Unique Id&quot;, &quot;description&quot;: &quot;The unique ID of the user.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='model' details='{&quot;title&quot;: &quot;Model&quot;, &quot;description&quot;: &quot;The name of the model to be used (e.g. gpt-4, codellama)&quot;, &quot;default&quot;: &quot;togethercomputer/RedPajama-INCITE-7B-Instruct&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="togethercomputer/RedPajama-INCITE-7B-Instruct"/>
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
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation OR an instance of the PromptTemplate class if you want to control other parameters. See the documentation for more information.&quot;, &quot;default&quot;: {&quot;edit&quot;: {&quot;model&quot;: null, &quot;temperature&quot;: null, &quot;top_p&quot;: null, &quot;top_k&quot;: null, &quot;presence_penalty&quot;: null, &quot;frequency_penalty&quot;: null, &quot;stop&quot;: [&quot;[/CODE]&quot;], &quot;max_tokens&quot;: 600, &quot;functions&quot;: null, &quot;prompt&quot;: &quot;[CODE]\n{{{code_to_edit}}}\n[/CODE]\n[INST]\nYou are an expert programmer and personal assistant, here is your task: \&quot;Rewrite the above code in order to {{{user_input}}}\&quot;\n\nYour answer should start with a [CODE] tag and end with a [/CODE] tag.\n[/INST]\n[CODE]&quot;, &quot;raw&quot;: true}}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{&#x27;edit&#x27;: {&#x27;model&#x27;: None, &#x27;temperature&#x27;: None, &#x27;top_p&#x27;: None, &#x27;top_k&#x27;: None, &#x27;presence_penalty&#x27;: None, &#x27;frequency_penalty&#x27;: None, &#x27;stop&#x27;: [&#x27;[/CODE]&#x27;], &#x27;max_tokens&#x27;: 600, &#x27;functions&#x27;: None, &#x27;prompt&#x27;: &#x27;[CODE]\n{{{code_to_edit}}}\n[/CODE]\n[INST]\nYou are an expert programmer and personal assistant, here is your task: &quot;Rewrite the above code in order to {{{user_input}}}&quot;\n\nYour answer should start with a [CODE] tag and end with a [/CODE] tag.\n[/INST]\n[CODE]&#x27;, &#x27;raw&#x27;: True}}"/>
