# Ask Sage

:::info

To get an Ask Sage API key login to the Ask Sage platform (If you don't have an account, you can create one [here](https://chat.asksage.ai/)) and follow the instructions in the Ask Sage Docs:[Ask Sage API Key](https://docs.asksage.ai/docs/api-documentation/api-documentation.html) 

:::

## Configuration

To use the Ask Sage models, the following configuration is required to the `config.json` file:

```json
{
  "models": [
    {
      "apiKey": "YOUR_API_KEY", 
      "apiBase": "https://api.asksage.ai/server/", // apiBase will be the same for all models, but will vary based on tenant. 
      "model": "gpt4-gov",
      "title": "GPT-4 gov",
      "provider": "askSage"
    }
  ]
}
```

The `apiBase` will be listed on the Ask Sage platform when you generate an `API key`. You will see context as shown below:

> Server API for query/training etc.:
> - Documentation: https://app.swaggerhub.com/apis-docs/NICOLASCHAILLAN_1/server_ask-sage_api/1.0
> - URL for this API is: https://api.asksage.ai/server/

## Usage

Currently, the setup for the models provided by Ask Sage is to support the following two functionalities provided by Continue.Dev: 

- `Chat` to understand and iterate on code in the sidebar
- `Edit` to modify code without leaving your current file

More models, functionalities and documentation will be added in the future for Ask Sage Integration.

> We recommend to utilize the`OpenAI` or `Anthropic` models for the best performance and results for the `Chat` and `Edit` functionalities.

## Current Models From Ask Sage Supported

The current Models available provided by Ask Sage are:

| Model              | Added |
|--------------------|-------|
| Gov GPT-4.0        |  Yes  |
| Gov GPT-4o         |  Yes  |
| GPT-4o             |  Yes  |
| GPT-4o-mini        |  Yes  |
| GPT-3.5-16K        |  Yes  |
| Calude 3 Opus      |  Yes  |
| Calude 3 Sonet     |  Yes  |
| Calude 3.5 Sonnet  |  Yes  |
| Gemini Pro         |  Yes  |
| llama 3            |  Yes  |
| Mistral Large      |  Yes  |

