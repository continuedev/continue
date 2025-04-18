# ContinueHubIdeApi.DefaultApi

All URIs are relative to *https://api.continue.dev*

Method | HTTP request | Description
------------- | ------------- | -------------
[**listAssistants**](DefaultApi.md#listAssistants) | **GET** /ide/list-assistants | List assistants for IDE



## listAssistants

> [ListAssistants200ResponseInner] listAssistants(opts)

List assistants for IDE

Returns a complete list of assistants available to the user, with their full configurations, icons, and other metadata needed by the IDE to display and use them.  This endpoint performs a full refresh of the list of assistants, including unrolling configurations and resolving secrets. 

### Example

```javascript
import ContinueHubIdeApi from 'continue_hub_ide_api';
let defaultClient = ContinueHubIdeApi.ApiClient.instance;
// Configure Bearer access token for authorization: apiKeyAuth
let apiKeyAuth = defaultClient.authentications['apiKeyAuth'];
apiKeyAuth.accessToken = "YOUR ACCESS TOKEN"

let apiInstance = new ContinueHubIdeApi.DefaultApi();
let opts = {
  'alwaysUseProxy': "alwaysUseProxy_example", // String | Whether to always use the Continue-managed proxy for model requests
  'organizationId': "organizationId_example" // String | ID of the organization to scope assistants to. If not provided, personal assistants are returned.
};
apiInstance.listAssistants(opts, (error, data, response) => {
  if (error) {
    console.error(error);
  } else {
    console.log('API called successfully. Returned data: ' + data);
  }
});
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **alwaysUseProxy** | **String**| Whether to always use the Continue-managed proxy for model requests | [optional] 
 **organizationId** | **String**| ID of the organization to scope assistants to. If not provided, personal assistants are returned. | [optional] 

### Return type

[**[ListAssistants200ResponseInner]**](ListAssistants200ResponseInner.md)

### Authorization

[apiKeyAuth](../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

