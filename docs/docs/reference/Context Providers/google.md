import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# GoogleContextProvider

Type '@google' to reference the results of a Google search. For example, type "@google python tutorial" if you want to search and discuss ways of learning Python.

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/plugins/context_providers/google.py)

## Properties

<ClassPropertyRef name='serper_api_key' details='{&quot;title&quot;: &quot;Serper Api Key&quot;, &quot;description&quot;: &quot;Your SerpAPI key, used to programmatically make Google searches. You can get a key at https://serper.dev.&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/>


### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;default&quot;: &quot;google&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="google"/>
<ClassPropertyRef name='display_title' details='{&quot;title&quot;: &quot;Display Title&quot;, &quot;default&quot;: &quot;Google&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Google"/>
<ClassPropertyRef name='description' details='{&quot;title&quot;: &quot;Description&quot;, &quot;default&quot;: &quot;Search Google&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Search Google"/>
<ClassPropertyRef name='dynamic' details='{&quot;title&quot;: &quot;Dynamic&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/>
<ClassPropertyRef name='requires_query' details='{&quot;title&quot;: &quot;Requires Query&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/>
