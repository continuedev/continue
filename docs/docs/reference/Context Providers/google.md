import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# GoogleContextProvider

The ContextProvider class is a plugin that lets you provide new information to the LLM by typing '@'.
When you type '@', the context provider will be asked to populate a list of options.
These options will be updated on each keystroke.
When you hit enter on an option, the context provider will add that item to the autopilot's list of context (which is all stored in the ContextManager object).

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/google.py)

## Properties

<ClassPropertyRef name='serper_api_key' details='{&quot;title&quot;: &quot;Serper Api Key&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/><ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;default&quot;: &quot;google&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="google"/><ClassPropertyRef name='display_title' details='{&quot;title&quot;: &quot;Display Title&quot;, &quot;default&quot;: &quot;Google&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Google"/><ClassPropertyRef name='description' details='{&quot;title&quot;: &quot;Description&quot;, &quot;default&quot;: &quot;Search Google&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Search Google"/><ClassPropertyRef name='dynamic' details='{&quot;title&quot;: &quot;Dynamic&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/><ClassPropertyRef name='requires_query' details='{&quot;title&quot;: &quot;Requires Query&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/><ClassPropertyRef name='GOOGLE_CONTEXT_ITEM_ID' details='{&quot;title&quot;: &quot;Google Context Item Id&quot;, &quot;default&quot;: &quot;google_search&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="google_search"/>

### Inherited Properties

