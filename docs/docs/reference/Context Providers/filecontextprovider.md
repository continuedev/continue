import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# FileContextProvider

The FileContextProvider is a ContextProvider that allows you to search files in the open workspace.

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/plugins/context_providers/file.py)

## Properties



### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;default&quot;: &quot;file&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="file"/>
<ClassPropertyRef name='display_title' details='{&quot;title&quot;: &quot;Display Title&quot;, &quot;default&quot;: &quot;Files&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Files"/>
<ClassPropertyRef name='description' details='{&quot;title&quot;: &quot;Description&quot;, &quot;default&quot;: &quot;Reference files in the current workspace&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Reference files in the current workspace"/>
<ClassPropertyRef name='dynamic' details='{&quot;title&quot;: &quot;Dynamic&quot;, &quot;default&quot;: false, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="False"/>
<ClassPropertyRef name='requires_query' details='{&quot;title&quot;: &quot;Requires Query&quot;, &quot;description&quot;: &quot;Indicates whether the ContextProvider requires a query. For example, the SearchContextProvider requires you to type &#x27;@search &lt;STRING_TO_SEARCH&gt;&#x27;. This will change the behavior of the UI so that it can indicate the expectation for a query.&quot;, &quot;default&quot;: false, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="False"/>
