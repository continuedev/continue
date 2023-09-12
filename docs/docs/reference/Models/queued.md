import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# QueuedLLM



[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/queued.py)

## Properties

<ClassPropertyRef name='llm' details='{"$ref": "#/definitions/LLM"}' required={true}/><ClassPropertyRef name='title' details='{"title": "Title", "type": "string"}' required={false}/><ClassPropertyRef name='system_message' details='{"title": "System Message", "type": "string"}' required={false}/><ClassPropertyRef name='context_length' details='{"title": "Context Length", "default": 2048, "type": "integer"}' required={false}/><ClassPropertyRef name='unique_id' details='{"title": "Unique Id", "type": "string"}' required={false}/><ClassPropertyRef name='model' details='{"title": "Model", "default": "queued", "type": "string"}' required={false}/><ClassPropertyRef name='timeout' details='{"title": "Timeout", "default": 300, "type": "integer"}' required={false}/><ClassPropertyRef name='prompt_templates' details='{"title": "Prompt Templates", "default": {}, "type": "object"}' required={false}/><ClassPropertyRef name='api_key' details='{"title": "Api Key", "type": "string"}' required={false}/>