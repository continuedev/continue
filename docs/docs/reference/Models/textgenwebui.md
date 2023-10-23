import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# TextGenWebUI

    TextGenWebUI is a comprehensive, open-source language model UI and local server. You can set it up with an OpenAI-compatible server plugin, but if for some reason that doesn't work, you can use this class like so:

    ```python title="~/.continue/config.py"
<<<<<<<< HEAD:server/continuedev/libs/llm/text_gen_interface.py
    from continuedev.libs.llm.text_gen_interface import TextGenUI
========
    from continuedev.libs.llm.text_gen_webui import TextGenWebUI
>>>>>>>> 16b0a48035350d350e05ae5fe17478ae78042904:server/continuedev/libs/llm/text_gen_webui.py

    config = ContinueConfig(
        ...
        models=Models(
            default=TextGenWebUI(
                model="<MODEL_NAME>",
            )
        )
    )
    ```


[View the source](https://github.com/continuedev/continue/blob/main/server/continuedev/libs/llm/libs/llm/text_gen_webui.py)

## Properties

<ClassPropertyRef name='server_url' details='{&quot;title&quot;: &quot;Server Url&quot;, &quot;description&quot;: &quot;URL of your TextGenWebUI server&quot;, &quot;default&quot;: &quot;http://localhost:5000&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="http://localhost:5000"/>
<ClassPropertyRef name='streaming_url' details='{&quot;title&quot;: &quot;Streaming Url&quot;, &quot;description&quot;: &quot;URL of your TextGenWebUI streaming server (separate from main server URL)&quot;, &quot;default&quot;: &quot;http://localhost:5005&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="http://localhost:5005"/>


### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;description&quot;: &quot;A title that will identify this model in the model selection dropdown&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='unique_id' details='{&quot;title&quot;: &quot;Unique Id&quot;, &quot;description&quot;: &quot;The unique ID of the user.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='model' details='{&quot;title&quot;: &quot;Model&quot;, &quot;description&quot;: &quot;The name of the model to be used (e.g. gpt-4, codellama)&quot;, &quot;default&quot;: &quot;text-gen-webui&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="text-gen-webui"/>
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
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation OR an instance of the PromptTemplate class if you want to control other parameters. See the documentation for more information.&quot;, &quot;default&quot;: {&quot;edit&quot;: &quot;Here is the code before editing:\n```\n{{{code_to_edit}}}\n```\n\nHere is the edit requested:\n\&quot;{{{user_input}}}\&quot;\n\nHere is the code after editing:&quot;}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{&#x27;edit&#x27;: &#x27;Here is the code before editing:\n```\n{{{code_to_edit}}}\n```\n\nHere is the edit requested:\n&quot;{{{user_input}}}&quot;\n\nHere is the code after editing:&#x27;}"/>
<ClassPropertyRef name='api_key' details='{&quot;title&quot;: &quot;Api Key&quot;, &quot;description&quot;: &quot;The API key for the LLM provider.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
