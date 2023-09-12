import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# URLContextProvider

The ContextProvider class is a plugin that lets you provide new information to the LLM by typing '@'.
When you type '@', the context provider will be asked to populate a list of options.
These options will be updated on each keystroke.
When you hit enter on an option, the context provider will add that item to the autopilot's list of context (which is all stored in the ContextManager object).

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/url.py)

## Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;default&quot;: &quot;url&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="url"/><ClassPropertyRef name='display_title' details='{&quot;title&quot;: &quot;Display Title&quot;, &quot;default&quot;: &quot;URL&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="URL"/><ClassPropertyRef name='description' details='{&quot;title&quot;: &quot;Description&quot;, &quot;default&quot;: &quot;Reference the contents of a webpage&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Reference the contents of a webpage"/><ClassPropertyRef name='dynamic' details='{&quot;title&quot;: &quot;Dynamic&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/><ClassPropertyRef name='requires_query' details='{&quot;title&quot;: &quot;Requires Query&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/><ClassPropertyRef name='preset_urls' details='{&quot;title&quot;: &quot;Preset Urls&quot;, &quot;default&quot;: [], &quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;type&quot;: &quot;string&quot;}}' required={false} default="[]"/><ClassPropertyRef name='static_url_context_items' details='{&quot;title&quot;: &quot;Static Url Context Items&quot;, &quot;default&quot;: [], &quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;$ref&quot;: &quot;#/definitions/ContextItem&quot;}}' required={false} default="[]"/><ClassPropertyRef name='DYNAMIC_URL_CONTEXT_ITEM_ID' details='{&quot;title&quot;: &quot;Dynamic Url Context Item Id&quot;, &quot;default&quot;: &quot;url&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="url"/>

### Inherited Properties

