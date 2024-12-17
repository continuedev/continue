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

## Ask Sage Documentation 
Ask Sage documentation is not available with Continue.Dev, so if you have any questions or need help with Ask Sage type `@ask` and select the `Ask Sage` option in the chat. Then procced to ask your question about Ask Sage.

## Current Models From Ask Sage Supported

The current Models available provided by Ask Sage are:

| Index | Model                  | Added | Status |
|-------|------------------------|-------|--------|
| 1     | GPT-4 Gov              |  Yes  | ✅     |
| 2     | GPT-4o Gov             |  Yes  | ✅     |
| 3     | GPT-4o-mini Gov        |  Yes  | ✅     |
| 4     | GPT-3.5-Turbo Gov      |  Yes  | ✅     |
| 5     | GPT-4o                 |  Yes  | ✅     |
| 6     | GPT-4o-mini            |  Yes  | ✅     |
| 7     | GPT-4                  |  Yes  | ✅     |
| 8     | GPT-4-32K              |  Yes  | ✅     |
| 9     | GPT-o1                 |  Yes  | ✅     |
| 10    | GPT-o1-mini            |  Yes  | ✅     |
| 11    | GPT-3.5-turbo          |  Yes  | ✅     |
| 12    | Calude 3.5 Sonnet Gov  |  Yes  | ✅     |
| 13    | Calude 3 Opus          |  Yes  | ✅     |
| 14    | Calude 3 Sonet         |  Yes  | ✅     |
| 15    | Calude 3.5 Sonnet      |  Yes  | ✅     |
| 16    | Grok (xAI)             |  Yes  | ✅     |
| 17    | Groq Llama 3.3         |  Yes  | ✅     |
| 18    | Groq 70B               |  Yes  | ✅     |
| 19    | Gemini Pro             |  Yes  | ✅     |
| 20    | llama 3                |  Yes  | ✅     |
| 21    | Mistral Large          |  Yes  | ✅     |

