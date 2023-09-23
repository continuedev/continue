import ClassPropertyRef from '@site/src/components/ClassPropertyRef.tsx';

# GitHubIssuesContextProvider

The GitHubIssuesContextProvider is a ContextProvider that allows you to search GitHub issues in a repo. Type '@issue' to reference the title and contents of an issue.

[View the source](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/plugins/context_providers/github.py)

## Properties

<ClassPropertyRef name='repo_name' details='{&quot;title&quot;: &quot;Repo Name&quot;, &quot;description&quot;: &quot;The name of the GitHub repo from which to pull issues&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/>
<ClassPropertyRef name='auth_token' details='{&quot;title&quot;: &quot;Auth Token&quot;, &quot;description&quot;: &quot;The GitHub auth token to use to authenticate with the GitHub API&quot;, &quot;type&quot;: &quot;string&quot;}' required={true} default=""/>


### Inherited Properties

<ClassPropertyRef name='title' details='{&quot;title&quot;: &quot;Title&quot;, &quot;default&quot;: &quot;issues&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="issues"/>
<ClassPropertyRef name='display_title' details='{&quot;title&quot;: &quot;Display Title&quot;, &quot;default&quot;: &quot;GitHub Issues&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="GitHub Issues"/>
<ClassPropertyRef name='description' details='{&quot;title&quot;: &quot;Description&quot;, &quot;default&quot;: &quot;Reference GitHub issues&quot;, &quot;type&quot;: &quot;string&quot;}' required={false} default="Reference GitHub issues"/>
<ClassPropertyRef name='dynamic' details='{&quot;title&quot;: &quot;Dynamic&quot;, &quot;default&quot;: false, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="False"/>
<ClassPropertyRef name='requires_query' details='{&quot;title&quot;: &quot;Requires Query&quot;, &quot;description&quot;: &quot;Indicates whether the ContextProvider requires a query. For example, the SearchContextProvider requires you to type &#x27;@search &lt;STRING_TO_SEARCH&gt;&#x27;. This will change the behavior of the UI so that it can indicate the expectation for a query.&quot;, &quot;default&quot;: false, &quot;type&quot;: &quot;boolean&quot;}' required={false} default="False"/>
