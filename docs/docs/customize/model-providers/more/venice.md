# Venice

Venice.AI is a privacy focused generative AI platform, allowing users to interact with open-source LLMs without storing any private user data. To get started with Venice's API, either purchase a pro account, stake $VVV to obtain daily inference allotments or fund your account with USD and head over to https://venice.ai/settings/api. Venice hosts state of the art open-source AI models and supports the OpenAI API  standard, allowing users to easily interact with the platform. Learn more about the Venice API at https://venice.ai/api.

Change `~/.continue/config.json` to look like the following.

```json title="config.json"
{
  "models": [
    {
      "provider": "venice",
      "title": "Autodetect",
      "model": "AUTODETECT",
      "apiKey": "..."
    }
  ]
}
```

To utilize features offered by the venice API that are not apart of the standard OpenAI API schema, include these as `venice_parameters`

For example, to use models with no system prompt, you can explicitly turn off the feature like so:

```json title="config.json"
{
  "completionOptions": {
    "venice_parameters": {
        "include_venice_system_prompt" : false
      },
    ...
  }    
}
```

Learn more about available settings [here](https://docs.venice.ai/api-reference/api-spec).