import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# SearchContextProvider

The ContextProvider class is a plugin that lets you provide new information to the LLM by typing '@'.
When you type '@', the context provider will be asked to populate a list of options.
These options will be updated on each keystroke.
When you hit enter on an option, the context provider will add that item to the autopilot's list of context (which is all stored in the ContextManager object).

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/llm/search.py)

## Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;default&quot;: &quot;search&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="search"/><ClassPropertyRef name='display_title' details='{&quot;title&quot;: &quot;Display Title&quot;, &quot;default&quot;: &quot;Search&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Search"/><ClassPropertyRef name='description' details='{&quot;title&quot;: &quot;Description&quot;, &quot;default&quot;: &quot;Search the workspace for all matches of an exact string (e.g. &#x27;@search console.log&#x27;)&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Search the workspace for all matches of an exact string (e.g. &#x27;@search console.log&#x27;)"/><ClassPropertyRef name='dynamic' details='{&quot;title&quot;: &quot;Dynamic&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/><ClassPropertyRef name='requires_query' details='{&quot;title&quot;: &quot;Requires Query&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/><ClassPropertyRef name='workspace_dir' details='{&quot;title&quot;: &quot;Workspace Dir&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default=""/><ClassPropertyRef name='SEARCH_CONTEXT_ITEM_ID' details='{&quot;title&quot;: &quot;Search Context Item Id&quot;, &quot;default&quot;: &quot;search&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="search"/>

### Inherited Properties

