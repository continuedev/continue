import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# TerminalContextProvider

Type '@terminal' to reference the contents of your IDE's terminal.

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/plugins/context_providers/terminal.py)

## Properties

<ClassPropertyRef name='get_last_n_commands' details='{&quot;title&quot;: &quot;Get Last N Commands&quot;, &quot;description&quot;: &quot;The number of previous commands to reference&quot;, &quot;default&quot;: 3, &quot;type&quot;: &quot;integer&quot;}' required={false} default="3"/>


### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;default&quot;: &quot;terminal&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="terminal"/>
<ClassPropertyRef name='display_title' details='{&quot;title&quot;: &quot;Display Title&quot;, &quot;default&quot;: &quot;Terminal&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Terminal"/>
<ClassPropertyRef name='description' details='{&quot;title&quot;: &quot;Description&quot;, &quot;default&quot;: &quot;Reference the contents of the terminal&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Reference the contents of the terminal"/>
<ClassPropertyRef name='dynamic' details='{&quot;title&quot;: &quot;Dynamic&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/>
<ClassPropertyRef name='requires_query' details='{&quot;title&quot;: &quot;Requires Query&quot;, &quot;description&quot;: &quot;Indicates whether the ContextProvider requires a query. For example, the SearchContextProvider requires you to type &#x27;@search &lt;STRING_TO_SEARCH&gt;&#x27;. This will change the behavior of the UI so that it can indicate the expectation for a query.&quot;, &quot;default&quot;: false, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="False"/>
