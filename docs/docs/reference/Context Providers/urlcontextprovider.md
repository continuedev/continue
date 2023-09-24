import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# URLContextProvider

Type '@url' to reference the contents of a URL. You can either reference preset URLs, or reference one dynamically by typing '@url https://example.com'. The text contents of the page will be fetched and used as context.

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/plugins/context_providers/url.py)

## Properties

<ClassPropertyRef name='preset_urls' details='{&quot;title&quot;: &quot;Preset Urls&quot;, &quot;description&quot;: &quot;A list of preset URLs that you will be able to quickly reference by typing &#x27;@url&#x27;&quot;, &quot;default&quot;: [], &quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;type&quot;: &quot;string&quot;}}' required={false} default="[]"/>


### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;default&quot;: &quot;url&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="url"/>
<ClassPropertyRef name='display_title' details='{&quot;title&quot;: &quot;Display Title&quot;, &quot;default&quot;: &quot;URL&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="URL"/>
<ClassPropertyRef name='description' details='{&quot;title&quot;: &quot;Description&quot;, &quot;default&quot;: &quot;Reference the contents of a webpage&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Reference the contents of a webpage"/>
<ClassPropertyRef name='dynamic' details='{&quot;title&quot;: &quot;Dynamic&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/>
<ClassPropertyRef name='requires_query' details='{&quot;title&quot;: &quot;Requires Query&quot;, &quot;default&quot;: true, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="True"/>
