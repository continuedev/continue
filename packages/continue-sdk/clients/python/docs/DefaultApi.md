# openapi_client.DefaultApi

All URIs are relative to *https://api.continue.dev*

Method | HTTP request | Description
------------- | ------------- | -------------
[**list_assistants**](DefaultApi.md#list_assistants) | **GET** /ide/list-assistants | List assistants for IDE


# **list_assistants**
> List[ListAssistants200ResponseInner] list_assistants(always_use_proxy=always_use_proxy, organization_id=organization_id)

List assistants for IDE

Returns a complete list of assistants available to the user, with their full configurations,
icons, and other metadata needed by the IDE to display and use them.

This endpoint performs a full refresh of the list of assistants, including unrolling
configurations and resolving secrets.


### Example

* Bearer Authentication (apiKeyAuth):

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
    organization_id = 'organization_id_example' # str | ID of the organization to scope assistants to. If not provided, personal assistants are returned. (optional)

    try:
        # List assistants for IDE
        api_response = api_instance.list_assistants(always_use_proxy=always_use_proxy, organization_id=organization_id)
        print("The response of DefaultApi->list_assistants:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_assistants: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **always_use_proxy** | **str**| Whether to always use the Continue-managed proxy for model requests | [optional] 
 **organization_id** | **str**| ID of the organization to scope assistants to. If not provided, personal assistants are returned. | [optional] 

### Return type

[**List[ListAssistants200ResponseInner]**](ListAssistants200ResponseInner.md)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successfully retrieved assistants |  -  |
**401** | Unauthorized - Authentication failed |  -  |
**404** | User not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

