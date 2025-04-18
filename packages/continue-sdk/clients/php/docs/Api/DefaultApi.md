# OpenAPI\Client\DefaultApi

All URIs are relative to https://api.continue.dev, except if the operation defines another base path.

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**listAssistants()**](DefaultApi.md#listAssistants) | **GET** /ide/list-assistants | List assistants for IDE |


## `listAssistants()`

```php
listAssistants($always_use_proxy, $organization_id): \OpenAPI\Client\models\ListAssistants200ResponseInner[]
```

List assistants for IDE

Returns a complete list of assistants available to the user, with their full configurations, icons, and other metadata needed by the IDE to display and use them.  This endpoint performs a full refresh of the list of assistants, including unrolling configurations and resolving secrets.

### Example

```php
<?php
require_once(__DIR__ . '/vendor/autoload.php');


// Configure Bearer authorization: apiKeyAuth
$config = OpenAPI\Client\Configuration::getDefaultConfiguration()->setAccessToken('YOUR_ACCESS_TOKEN');


$apiInstance = new OpenAPI\Client\Api\DefaultApi(
    // If you want use custom http client, pass your client which implements `GuzzleHttp\ClientInterface`.
    // This is optional, `GuzzleHttp\Client` will be used as default.
    new GuzzleHttp\Client(),
    $config
);
$always_use_proxy = 'always_use_proxy_example'; // string | Whether to always use the Continue-managed proxy for model requests
$organization_id = 'organization_id_example'; // string | ID of the organization to scope assistants to. If not provided, personal assistants are returned.

try {
    $result = $apiInstance->listAssistants($always_use_proxy, $organization_id);
    print_r($result);
} catch (Exception $e) {
    echo 'Exception when calling DefaultApi->listAssistants: ', $e->getMessage(), PHP_EOL;
}
```

### Parameters

| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **always_use_proxy** | **string**| Whether to always use the Continue-managed proxy for model requests | [optional] |
| **organization_id** | **string**| ID of the organization to scope assistants to. If not provided, personal assistants are returned. | [optional] |

### Return type

[**\OpenAPI\Client\models\ListAssistants200ResponseInner[]**](../Model/ListAssistants200ResponseInner.md)

### Authorization

[apiKeyAuth](../../README.md#apiKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

[[Back to top]](#) [[Back to API list]](../../README.md#endpoints)
[[Back to Model list]](../../README.md#models)
[[Back to README]](../../README.md)
