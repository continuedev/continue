import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# HuggingFaceInferenceAPI

Hugging Face Inference API is a great option for newly released language models. Sign up for an account and add billing [here](https://huggingface.co/settings/billing), access the Inference Endpoints [here](https://ui.endpoints.huggingface.co), click on “New endpoint”, and fill out the form (e.g. select a model like [WizardCoder-Python-34B-V1.0](https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0)), and then deploy your model by clicking “Create Endpoint”. Change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
    "models": [{
        "title": "Hugging Face Inference API",
        "provider": "huggingface-inference-api",
        "model": "MODEL_NAME",
        "api_key": "YOUR_HF_TOKEN",
        "api_base": "INFERENCE_API_ENDPOINT_URL"
    }]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/server/continuedev/libs/llm/hf_inference_api.py)

## Properties



### Inherited Properties

<ClassPropertyRef name='api_key' details='{&quot;title&quot;: &quot;Api Key&quot;, &quot;description&quot;: &quot;Your Hugging Face API token&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/>
<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;description&quot;: &quot;A title that will identify this model in the model selection dropdown&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='unique_id' details='{&quot;title&quot;: &quot;Unique Id&quot;, &quot;description&quot;: &quot;The unique ID of the user.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='model' details='{&quot;title&quot;: &quot;Model&quot;, &quot;description&quot;: &quot;The name of the model to use (optional for the HuggingFaceInferenceAPI class)&quot;, &quot;default&quot;: &quot;Hugging Face Inference API&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Hugging Face Inference API"/>
<ClassPropertyRef name='system_message' details='{&quot;title&quot;: &quot;System Message&quot;, &quot;description&quot;: &quot;A system message that will always be followed by the LLM&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='context_length' details='{&quot;title&quot;: &quot;Context Length&quot;, &quot;description&quot;: &quot;The maximum context length of the LLM in tokens, as counted by count_tokens.&quot;, &quot;default&quot;: 2048, &quot;type&quot;: &quot;integer&quot;}' required={false} default="2048"/>
<ClassPropertyRef name='completion_options' details='{&quot;title&quot;: &quot;Completion Options&quot;, &quot;description&quot;: &quot;Options for the completion endpoint. Read more about the completion options in the documentation.&quot;, &quot;default&quot;: {&quot;temperature&quot;: null, &quot;top_p&quot;: null, &quot;top_k&quot;: null, &quot;presence_penalty&quot;: null, &quot;frequency_penalty&quot;: null, &quot;stop&quot;: null, &quot;max_tokens&quot;: 600}, &quot;allOf&quot;: [{&quot;$ref&quot;: &quot;#/definitions/BaseCompletionOptions&quot;}]}' required={false} default="{&#x27;temperature&#x27;: None, &#x27;top_p&#x27;: None, &#x27;top_k&#x27;: None, &#x27;presence_penalty&#x27;: None, &#x27;frequency_penalty&#x27;: None, &#x27;stop&#x27;: None, &#x27;max_tokens&#x27;: 600}"/>
<ClassPropertyRef name='request_options' details='{&quot;title&quot;: &quot;Request Options&quot;, &quot;description&quot;: &quot;Options for the HTTP request to the LLM.&quot;, &quot;default&quot;: {&quot;timeout&quot;: 300, &quot;verify_ssl&quot;: null, &quot;ca_bundle_path&quot;: null, &quot;proxy&quot;: null, &quot;headers&quot;: null}, &quot;allOf&quot;: [{&quot;$ref&quot;: &quot;#/definitions/RequestOptions&quot;}]}' required={false} default="{&#x27;timeout&#x27;: 300, &#x27;verify_ssl&#x27;: None, &#x27;ca_bundle_path&#x27;: None, &#x27;proxy&#x27;: None, &#x27;headers&#x27;: None}"/>
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.&quot;, &quot;default&quot;: {}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{}"/>
<ClassPropertyRef name='api_base' details='{&quot;title&quot;: &quot;Api Base&quot;, &quot;description&quot;: &quot;Your Hugging Face Inference API endpoint URL&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
