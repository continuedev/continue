import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# LlamaCpp

Run the llama.cpp server binary to start the API server. If running on a remote server, be sure to set host to 0.0.0.0:

```shell
.\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models\meta\llama\codellama-7b-instruct.Q8_0.gguf
```

After it's up and running, change `~/.continue/config.py` to look like this:

```python
from continuedev.src.continuedev.libs.llm.llamacpp import LlamaCpp

config = ContinueConfig(
    ...
    models=Models(
        default=LlamaCpp(
            max_context_length=4096,
            server_url="http://localhost:8080")
    )
)
```

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/llamacpp.py)

## Properties

<ClassPropertyRef name='server_url' details='{&quot;title&quot;: &quot;Server Url&quot;, &quot;description&quot;: &quot;URL of the server&quot;, &quot;default&quot;: &quot;http://localhost:8080&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="http://localhost:8080"/>
<ClassPropertyRef name='llama_cpp_args' details='{&quot;title&quot;: &quot;Llama Cpp Args&quot;, &quot;description&quot;: &quot;A list of additional arguments to pass to llama.cpp. See [here](https://github.com/ggerganov/llama.cpp/tree/master/examples/server#api-endpoints) for the complete catalog of options.&quot;, &quot;default&quot;: {&quot;stop&quot;: [&quot;[INST]&quot;]}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{&#x27;stop&#x27;: [&#x27;[INST]&#x27;]}"/>


### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;description&quot;: &quot;A title that will identify this model in the model selection dropdown&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='system_message' details='{&quot;title&quot;: &quot;System Message&quot;, &quot;description&quot;: &quot;A system message that will always be followed by the LLM&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='context_length' details='{&quot;title&quot;: &quot;Context Length&quot;, &quot;description&quot;: &quot;The maximum context length of the LLM in tokens, as counted by count_tokens.&quot;, &quot;default&quot;: 2048, &quot;type&quot;: &quot;integer&quot;}' required={false} default="2048"/>
<ClassPropertyRef name='unique_id' details='{&quot;title&quot;: &quot;Unique Id&quot;, &quot;description&quot;: &quot;The unique ID of the user.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='model' details='{&quot;title&quot;: &quot;Model&quot;, &quot;description&quot;: &quot;The name of the model to be used (e.g. gpt-4, codellama)&quot;, &quot;default&quot;: &quot;llamacpp&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="llamacpp"/>
<ClassPropertyRef name='stop_tokens' details='{&quot;title&quot;: &quot;Stop Tokens&quot;, &quot;description&quot;: &quot;Tokens that will stop the completion.&quot;, &quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;type&quot;: &quot;string&quot;}}' required={false} default=""/>
<ClassPropertyRef name='timeout' details='{&quot;title&quot;: &quot;Timeout&quot;, &quot;description&quot;: &quot;Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.&quot;, &quot;default&quot;: 300, &quot;type&quot;: &quot;integer&quot;}' required={false} default="300"/>
<ClassPropertyRef name='verify_ssl' details='{&quot;title&quot;: &quot;Verify Ssl&quot;, &quot;description&quot;: &quot;Whether to verify SSL certificates for requests.&quot;, &quot;type&quot;: &quot;boolean&quot;}' required={false} default=""/>
<ClassPropertyRef name='ca_bundle_path' details='{&quot;title&quot;: &quot;Ca Bundle Path&quot;, &quot;description&quot;: &quot;Path to a custom CA bundle to use when making the HTTP request&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='proxy' details='{&quot;title&quot;: &quot;Proxy&quot;, &quot;description&quot;: &quot;Proxy URL to use when making the HTTP request&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.&quot;, &quot;default&quot;: {&quot;edit&quot;: &quot;Consider the following code:\n```\n{{{code_to_edit}}}\n```\nEdit the code to perfectly satisfy the following user request:\n{{{user_input}}}\nOutput nothing except for the code. No code block, no English explanation, no start/end tags.&quot;}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{&#x27;edit&#x27;: &#x27;Consider the following code:\n```\n{{{code_to_edit}}}\n```\nEdit the code to perfectly satisfy the following user request:\n{{{user_input}}}\nOutput nothing except for the code. No code block, no English explanation, no start/end tags.&#x27;}"/>
<ClassPropertyRef name='api_key' details='{&quot;title&quot;: &quot;Api Key&quot;, &quot;description&quot;: &quot;The API key for the LLM provider.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
