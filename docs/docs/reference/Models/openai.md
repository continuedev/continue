import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# OpenAI

The OpenAI class can be used to access OpenAI models like gpt-4 and gpt-3.5-turbo.

If you are running a local model with an OpenAI-compatible API, you can also use the OpenAI class by changing the `api_base` argument.

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/openai.py)

## Properties

<ClassPropertyRef name='model' details='{"title": "Model", "type": "string"}' required={true}/><ClassPropertyRef name='api_key' details='{"title": "Api Key", "description": "OpenAI API key", "type": "string"}' required={true}/><ClassPropertyRef name='title' details='{"title": "Title", "type": "string"}' required={false}/><ClassPropertyRef name='system_message' details='{"title": "System Message", "type": "string"}' required={false}/><ClassPropertyRef name='context_length' details='{"title": "Context Length", "default": 2048, "type": "integer"}' required={false}/><ClassPropertyRef name='unique_id' details='{"title": "Unique Id", "type": "string"}' required={false}/><ClassPropertyRef name='timeout' details='{"title": "Timeout", "default": 300, "type": "integer"}' required={false}/><ClassPropertyRef name='prompt_templates' details='{"title": "Prompt Templates", "default": {}, "type": "object"}' required={false}/><ClassPropertyRef name='verify_ssl' details='{"title": "Verify Ssl", "type": "boolean"}' required={false}/><ClassPropertyRef name='ca_bundle_path' details='{"title": "Ca Bundle Path", "type": "string"}' required={false}/><ClassPropertyRef name='proxy' details='{"title": "Proxy", "type": "string"}' required={false}/><ClassPropertyRef name='api_base' details='{"title": "Api Base", "type": "string"}' required={false}/><ClassPropertyRef name='api_type' details='{"title": "Api Type", "enum": ["azure", "openai"], "type": "string"}' required={false}/><ClassPropertyRef name='api_version' details='{"title": "Api Version", "type": "string"}' required={false}/><ClassPropertyRef name='engine' details='{"title": "Engine", "type": "string"}' required={false}/>