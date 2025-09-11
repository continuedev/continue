# openapi_client.DefaultApi

All URIs are relative to *https://api.continue.dev*

| Method                                                                             | HTTP request                                         | Description                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| [**get_assistant**](DefaultApi.md#get_assistant)                                   | **GET** /ide/get-assistant/{ownerSlug}/{packageSlug} | Get a specific agent by slug                  |
| [**get_free_trial_status**](DefaultApi.md#get_free_trial_status)                   | **GET** /ide/free-trial-status                       | Get free trial status for user                    |
| [**get_models_add_on_checkout_url**](DefaultApi.md#get_models_add_on_checkout_url) | **GET** /ide/get-models-add-on-checkout-url          | Get Stripe checkout URL for models add-on         |
| [**get_policy**](DefaultApi.md#get_policy)                                         | **GET** /ide/policy                                  | Get organization policy                           |
| [**list_assistant_full_slugs**](DefaultApi.md#list_assistant_full_slugs)           | **GET** /ide/list-assistant-full-slugs               | List agent full slugs (currently returns 429) |
| [**list_assistants**](DefaultApi.md#list_assistants)                               | **GET** /ide/list-assistants                         | List agents for IDE                           |
| [**list_organizations**](DefaultApi.md#list_organizations)                         | **GET** /ide/list-organizations                      | List organizations for user                       |
| [**sync_secrets**](DefaultApi.md#sync_secrets)                                     | **POST** /ide/sync-secrets                           | Synchronize secrets for user                      |

# **get_assistant**

> GetAssistant200Response get_assistant(owner_slug, package_slug, always_use_proxy=always_use_proxy, organization_id=organization_id)

Get a specific agent by slug

Returns a single agent configuration by its owner and package slug.
This endpoint is useful when you need to retrieve or refresh a specific agent
without fetching the entire list.

### Example

- Bearer Authentication (apiKeyAuth):

```python
import openapi_client
from openapi_client.models.get_assistant200_response import GetAssistant200Response
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://api.continue.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://api.continue.dev"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: apiKeyAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    owner_slug = 'owner_slug_example' # str | Slug of the user or organization that owns the agent
    package_slug = 'package_slug_example' # str | Slug of the agent package
    always_use_proxy = 'always_use_proxy_example' # str | Whether to always use the Continue-managed proxy for model requests (optional)
    organization_id = 'organization_id_example' # str | ID of the organization to scope agents to. If not provided, personal agents are returned. (optional)

    try:
        # Get a specific agent by slug
        api_response = api_instance.get_assistant(owner_slug, package_slug, always_use_proxy=always_use_proxy, organization_id=organization_id)
        print("The response of DefaultApi->get_assistant:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_assistant: %s\n" % e)
```

### Parameters

| Name                 | Type    | Description                                                                                       | Notes      |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------- | ---------- |
| **owner_slug**       | **str** | Slug of the user or organization that owns the agent                                          |
| **package_slug**     | **str** | Slug of the agent package                                                                     |
| **always_use_proxy** | **str** | Whether to always use the Continue-managed proxy for model requests                               | [optional] |
| **organization_id**  | **str** | ID of the organization to scope agents to. If not provided, personal agents are returned. | [optional] |

### Return type

[**GetAssistant200Response**](GetAssistant200Response.md)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                                       | Response headers |
| ----------- | ------------------------------------------------- | ---------------- |
| **200**     | Successfully retrieved agent                  | -                |
| **401**     | Unauthorized - Authentication failed              | -                |
| **403**     | Forbidden - Assistant not allowed in organization | -                |
| **404**     | User or agent not found                       | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_free_trial_status**

> GetFreeTrialStatus200Response get_free_trial_status()

Get free trial status for user

Returns the current free trial status for the authenticated user, including
usage counts and limits for chat and autocomplete features.

### Example

- Bearer Authentication (apiKeyAuth):

```python
import openapi_client
from openapi_client.models.get_free_trial_status200_response import GetFreeTrialStatus200Response
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://api.continue.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://api.continue.dev"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: apiKeyAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get free trial status for user
        api_response = api_instance.get_free_trial_status()
        print("The response of DefaultApi->get_free_trial_status:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_free_trial_status: %s\n" % e)
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**GetFreeTrialStatus200Response**](GetFreeTrialStatus200Response.md)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                              | Response headers |
| ----------- | ---------------------------------------- | ---------------- |
| **200**     | Successfully retrieved free trial status | -                |
| **404**     | User not found                           | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_models_add_on_checkout_url**

> GetModelsAddOnCheckoutUrl200Response get_models_add_on_checkout_url(profile_id=profile_id, vscode_uri_scheme=vscode_uri_scheme)

Get Stripe checkout URL for models add-on

Creates a Stripe checkout session for the models add-on subscription
and returns the checkout URL.

### Example

- Bearer Authentication (apiKeyAuth):

```python
import openapi_client
from openapi_client.models.get_models_add_on_checkout_url200_response import GetModelsAddOnCheckoutUrl200Response
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://api.continue.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://api.continue.dev"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: apiKeyAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    profile_id = 'profile_id_example' # str | Profile ID to include in the callback URL (optional)
    vscode_uri_scheme = 'vscode_uri_scheme_example' # str | VS Code URI scheme to include in the callback URL (optional)

    try:
        # Get Stripe checkout URL for models add-on
        api_response = api_instance.get_models_add_on_checkout_url(profile_id=profile_id, vscode_uri_scheme=vscode_uri_scheme)
        print("The response of DefaultApi->get_models_add_on_checkout_url:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_models_add_on_checkout_url: %s\n" % e)
```

### Parameters

| Name                  | Type    | Description                                       | Notes      |
| --------------------- | ------- | ------------------------------------------------- | ---------- |
| **profile_id**        | **str** | Profile ID to include in the callback URL         | [optional] |
| **vscode_uri_scheme** | **str** | VS Code URI scheme to include in the callback URL | [optional] |

### Return type

[**GetModelsAddOnCheckoutUrl200Response**](GetModelsAddOnCheckoutUrl200Response.md)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                           | Response headers |
| ----------- | ------------------------------------- | ---------------- |
| **200**     | Successfully created checkout session | -                |
| **404**     | User not found                        | -                |
| **500**     | Failed to create checkout session     | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_policy**

> GetPolicy200Response get_policy()

Get organization policy

Returns the policy configuration for the first organization
that the user belongs to which has a policy configured.

### Example

- Bearer Authentication (apiKeyAuth):

```python
import openapi_client
from openapi_client.models.get_policy200_response import GetPolicy200Response
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://api.continue.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://api.continue.dev"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: apiKeyAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get organization policy
        api_response = api_instance.get_policy()
        print("The response of DefaultApi->get_policy:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_policy: %s\n" % e)
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**GetPolicy200Response**](GetPolicy200Response.md)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                   | Response headers |
| ----------- | ----------------------------- | ---------------- |
| **200**     | Successfully retrieved policy | -                |
| **404**     | User not found                | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_assistant_full_slugs**

> list_assistant_full_slugs()

List agent full slugs (currently returns 429)

This endpoint is temporarily disabled and returns a 429 status code
to prevent constant refreshes of the full agent list until a
fixed client version can be deployed.

### Example

- Bearer Authentication (apiKeyAuth):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://api.continue.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://api.continue.dev"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: apiKeyAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List agent full slugs (currently returns 429)
        api_instance.list_assistant_full_slugs()
    except Exception as e:
        print("Exception when calling DefaultApi->list_assistant_full_slugs: %s\n" % e)
```

### Parameters

This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                                       | Response headers |
| ----------- | ------------------------------------------------- | ---------------- |
| **429**     | Too many requests - endpoint temporarily disabled | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_assistants**

> List[ListAssistants200ResponseInner] list_assistants(always_use_proxy=always_use_proxy, organization_id=organization_id)

List agents for IDE

Returns a complete list of agents available to the user, with their full configurations,
icons, and other metadata needed by the IDE to display and use them.

This endpoint performs a full refresh of the list of agents, including unrolling
configurations and resolving secrets.

### Example

- Bearer Authentication (apiKeyAuth):

```python
import openapi_client
from openapi_client.models.list_assistants200_response_inner import ListAssistants200ResponseInner
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://api.continue.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://api.continue.dev"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: apiKeyAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    always_use_proxy = 'always_use_proxy_example' # str | Whether to always use the Continue-managed proxy for model requests (optional)
    organization_id = 'organization_id_example' # str | ID of the organization to scope agents to. If not provided, personal agents are returned. (optional)

    try:
        # List agents for IDE
        api_response = api_instance.list_assistants(always_use_proxy=always_use_proxy, organization_id=organization_id)
        print("The response of DefaultApi->list_assistants:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_assistants: %s\n" % e)
```

### Parameters

| Name                 | Type    | Description                                                                                       | Notes      |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------- | ---------- |
| **always_use_proxy** | **str** | Whether to always use the Continue-managed proxy for model requests                               | [optional] |
| **organization_id**  | **str** | ID of the organization to scope agents to. If not provided, personal agents are returned. | [optional] |

### Return type

[**List[ListAssistants200ResponseInner]**](ListAssistants200ResponseInner.md)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                          | Response headers |
| ----------- | ------------------------------------ | ---------------- |
| **200**     | Successfully retrieved agents    | -                |
| **401**     | Unauthorized - Authentication failed | -                |
| **404**     | User not found                       | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_organizations**

> ListOrganizations200Response list_organizations()

List organizations for user

Returns a list of organizations that the authenticated user belongs to,
including organization metadata and pre-signed icon URLs.

### Example

- Bearer Authentication (apiKeyAuth):

```python
import openapi_client
from openapi_client.models.list_organizations200_response import ListOrganizations200Response
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://api.continue.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://api.continue.dev"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: apiKeyAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List organizations for user
        api_response = api_instance.list_organizations()
        print("The response of DefaultApi->list_organizations:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_organizations: %s\n" % e)
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**ListOrganizations200Response**](ListOrganizations200Response.md)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                          | Response headers |
| ----------- | ------------------------------------ | ---------------- |
| **200**     | Successfully retrieved organizations | -                |
| **404**     | User not found                       | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sync_secrets**

> List[Optional[object]] sync_secrets(sync_secrets_request)

Synchronize secrets for user

Resolves and synchronizes secrets for the authenticated user based on
the provided Fully Qualified Secret Names (FQSNs).

### Example

- Bearer Authentication (apiKeyAuth):

```python
import openapi_client
from openapi_client.models.sync_secrets_request import SyncSecretsRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to https://api.continue.dev
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "https://api.continue.dev"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: apiKeyAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    sync_secrets_request = openapi_client.SyncSecretsRequest() # SyncSecretsRequest |

    try:
        # Synchronize secrets for user
        api_response = api_instance.sync_secrets(sync_secrets_request)
        print("The response of DefaultApi->sync_secrets:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->sync_secrets: %s\n" % e)
```

### Parameters

| Name                     | Type                                            | Description | Notes |
| ------------------------ | ----------------------------------------------- | ----------- | ----- |
| **sync_secrets_request** | [**SyncSecretsRequest**](SyncSecretsRequest.md) |             |

### Return type

**List[Optional[object]]**

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                   | Response headers |
| ----------- | ----------------------------- | ---------------- |
| **200**     | Successfully resolved secrets | -                |
| **404**     | User not found                | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
