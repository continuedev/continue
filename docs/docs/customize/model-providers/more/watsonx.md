# IBM watsonx

watsonx, developed by IBM, offers a variety of pre-trained AI foundation models that can be used for natural language processing (NLP), computer vision, and speech recognition tasks.

## Setup

Accessing watsonx models can be done either through watsonx SaaS on IBM Cloud or using a dedicated watsonx.ai Software instance.

### watsonx.ai SaaS - IBM Cloud

To get started with watsonx SaaS, visit the [registration page](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx). If you do not have an existing IBM Cloud account, you can sign up for a free trial.

To authenticate to watsonx.ai SaaS with Continue, you will need to create a project and [set up an API key](https://www.ibm.com/docs/en/mas-cd/continuous-delivery?topic=cli-creating-your-cloud-api-key). Then, in continue:

- Set **apiBase** to your watsonx SaaS endpoint, e.g. `https://us-south.ml.cloud.ibm.com` for US South region.
- Set **projectId** to your watsonx project ID.
- Set **apiKey** to your watsonx API Key.

### watsonx.ai Software

To authenticate to your watsonx.ai Software instance with Continue, you can use either `username/password` or `ZenApiKey` method:

1. _Option 1_ (Recommended): using `ZenApiKey` authentication:
    - Set **apiBase** to your watsonx software endpoint, e.g. `https://cpd-watsonx.apps.example.com`.
    - Set **projectId** to your watsonx project ID.
    - Set **apiKey** to your watsonx Zen API Key. To generate it:
        1. Log in to the CPD web client.
        2. From the toolbar, click your avatar.
        3. Click **Profile and settings**.
        4. Click **API key** > **Generate new key**.
        5. Click **Generate**.
        6. Click **Copy** and save your key somewhere safe. You cannot recover this key if you lose it.
        7. Generate your ZenApiKey by running the following command in your preferred terminal: `echo "<username>:<apikey>" | base64`, replacing `<username>` with your CPD username and `<apikey>` with the API Key you just created.
2. _Option 2_: using `username/password` authentication:
    - Set **apiBase** to your watsonx software endpoint, e.g. `https://cpd-watsonx.apps.example.com`.
    - Set **projectId** to your watsonx project ID.
    - Set **API Key** to your watsonx Username and Password using `username:password` as format.

## Configuration

Add the following configuration to your `config.json` file to use the watsonx provider.

```json title="~/.continue/config.json"
{
  "models": [
    {
      "model": "model ID",
      "title": "watsonx - Model Name",
      "provider": "watsonx",
      "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "projectId": "PROJECT_ID",
      "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "apiVersion": "2024-03-14"
    }
  ]
}
```

`apiVersion` is optional and defaults to the latest version.


If you are using a custom deployment endpoint, set `deploymentID` to the model's deployment ID. You can find it in the watsonx.ai Prompt Lab UI by selecting the corresponding model and opening the `</>` tab on the right, which will display the endpoint's URL containing the deployment ID.

```json title="~/.continue/config.json"
{
  "models": [
    {
      "model": "model ID",
      "title": "watsonx - Model Name",
      "provider": "watsonx",
      "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "apiVersion": "2024-03-14",
      "deploymentId": "DEPLOYMENT_ID"
    }
  ]
}
```

### Configuration Options

Make sure to specify a template name, such as `granite` or `llama3`, and to set the `contextLength` to the model's context window size.
You can also configure generation parameters, such as temperature, topP, topK, frequency penalty, and stop sequences:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "model": "ibm/granite-20b-code-instruct",
      "title": "Granite Code 20b",
      "provider": "watsonx",
      "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "projectId": "PROJECT_ID",
      "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "apiVersion": "2024-03-14",
      "template": "granite",
      "contextLength": 8000,
      "completionOptions": {
        "temperature": 0.1,
        "topP": 0.3,
        "topK": 20,
        "maxTokens": 2000,
        "frequencyPenalty": 1.1,
        "stop": [
          "Question:",
          "\n\n\n"
        ]
      }
    }
  ]
}
```

## Tab Auto Complete Model

Granite models are recommended for tab auto complete. The configuration is similar to that of the chat models:
```json title="~/.continue/config.json"
{
    "tabAutocompleteModel": {
      "model": "ibm/granite-8b-code-instruct",
      "title": "Granite Code 8b",
      "provider": "watsonx",
      "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "projectId": "PROJECT_ID",
      "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "apiVersion": "2024-03-14",
      "contextLength": 4000
    }
}
```

## Embeddings Model

To view the list of available embeddings models, visit [this page](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models-embed.html?context=wx&pos=2#ibm-provided).
```json title="~/.continue/config.json
{
  "embeddingsProvider": {
    "provider": "watsonx",
    "model": "ibm/slate-30m-english-rtrvr-v2",
    "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
    "projectId": "PROJECT_ID",
    "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
    "apiVersion": "2024-03-14"
  }
}
```
