import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# Ollama

[Ollama](https://ollama.ai/) is a Mac application that makes it easy to locally run open-source models, including Llama-2. Download the app from the website, and it will walk you through setup in a couple of minutes. You can also read more in their [README](https://github.com/jmorganca/ollama). Continue can then be configured to use the `Ollama` LLM class:

```python
from continuedev.src.continuedev.libs.llm.ollama import Ollama

config = ContinueConfig(
    ...
    models=Models(
        default=Ollama(model="llama2")
    )
)
```
[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/ollama.py)
## Discover all available Models automtically

If you want to add configs for all your local Ollama models automatically add the Following to your config file:

```python
import requests

[...]
def get_model_names(url):
    try:
        # Send a GET request to the URL
        response = requests.get(url)

        # Check if the request was successful (status code 200)
        if response.status_code == 200:
            # Parse the JSON data from the response
            data = response.json()

            # Extract the "name" field from each object in the "models" array
            names = [model["name"] for model in data.get("models", [])]

            return names
        else:
            # Print an error message if the request was not successful
            print(f"Failed to fetch data. Status code: {response.status_code}")
            return []
    except Exception as e:
        # Handle any exceptions that may occur during the request
        print(f"An error occurred: {str(e)}")
        return []

# Function to process model names
def process_model_name(name):
    return Ollama(
			context_length=2048,
			model=name,
			timeout=300,
			prompt_templates={'edit': 'Consider the following code:\n```\n{{{code_to_edit}}}\n```\nEdit the code to perfectly satisfy the following user request:\n{{{user_input}}}\nOutput nothing except for the code. No code block, no English explanation, no start/end tags.'},
			server_url="http://localhost:11434"
		)  

# Example usage:
# URL to local Ollama installation and get all available tags
url = "http://localhost:11434/api/tags"
model_names = get_model_names(url)

# Check if model_names is empty and make sure it returns empty array
if not model_names:
    processed_names = []
else:
    # Use map to apply the process_model_name function to each name in the list
    processed_names = list(map(process_model_name, model_names))
[...]

config = ContinueConfig(
    ...
    models=Models(
        default=Ollama(model="llama2")
        unused=processed_names
    )
)
```
After you Reloaded you should see all models present in your Ollama installation in the dropdown.
This works only once, as the config gets rewritten when you change Models.
You would need to add the Models block again if you want to update it with your Ollama models again.

## Properties

<ClassPropertyRef name='server_url' details='{&quot;title&quot;: &quot;Server Url&quot;, &quot;description&quot;: &quot;URL of the Ollama server&quot;, &quot;default&quot;: &quot;http://localhost:11434&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="http://localhost:11434"/>


### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;description&quot;: &quot;A title that will identify this model in the model selection dropdown&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='system_message' details='{&quot;title&quot;: &quot;System Message&quot;, &quot;description&quot;: &quot;A system message that will always be followed by the LLM&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='context_length' details='{&quot;title&quot;: &quot;Context Length&quot;, &quot;description&quot;: &quot;The maximum context length of the LLM in tokens, as counted by count_tokens.&quot;, &quot;default&quot;: 2048, &quot;type&quot;: &quot;integer&quot;}' required={false} default="2048"/>
<ClassPropertyRef name='unique_id' details='{&quot;title&quot;: &quot;Unique Id&quot;, &quot;description&quot;: &quot;The unique ID of the user.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='model' details='{&quot;title&quot;: &quot;Model&quot;, &quot;description&quot;: &quot;The name of the model to be used (e.g. gpt-4, codellama)&quot;, &quot;default&quot;: &quot;llama2&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="llama2"/>
<ClassPropertyRef name='stop_tokens' details='{&quot;title&quot;: &quot;Stop Tokens&quot;, &quot;description&quot;: &quot;Tokens that will stop the completion.&quot;, &quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;type&quot;: &quot;string&quot;}}' required={false} default=""/>
<ClassPropertyRef name='timeout' details='{&quot;title&quot;: &quot;Timeout&quot;, &quot;description&quot;: &quot;Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.&quot;, &quot;default&quot;: 300, &quot;type&quot;: &quot;integer&quot;}' required={false} default="300"/>
<ClassPropertyRef name='verify_ssl' details='{&quot;title&quot;: &quot;Verify Ssl&quot;, &quot;description&quot;: &quot;Whether to verify SSL certificates for requests.&quot;, &quot;type&quot;: &quot;boolean&quot;}' required={false} default=""/>
<ClassPropertyRef name='ca_bundle_path' details='{&quot;title&quot;: &quot;Ca Bundle Path&quot;, &quot;description&quot;: &quot;Path to a custom CA bundle to use when making the HTTP request&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
<ClassPropertyRef name='prompt_templates' details='{&quot;title&quot;: &quot;Prompt Templates&quot;, &quot;description&quot;: &quot;A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the \&quot;edit\&quot; key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.&quot;, &quot;default&quot;: {&quot;edit&quot;: &quot;Consider the following code:\n```\n{{code_to_edit}}\n```\nEdit the code to perfectly satisfy the following user request:\n{{user_input}}\nOutput nothing except for the code. No code block, no English explanation, no start/end tags.&quot;}, &quot;type&quot;: &quot;object&quot;}' required={false} default="{&#x27;edit&#x27;: &#x27;Consider the following code:\n```\n{{code_to_edit}}\n```\nEdit the code to perfectly satisfy the following user request:\n{{user_input}}\nOutput nothing except for the code. No code block, no English explanation, no start/end tags.&#x27;}"/>
<ClassPropertyRef name='api_key' details='{&quot;title&quot;: &quot;Api Key&quot;, &quot;description&quot;: &quot;The API key for the LLM provider.&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/>
