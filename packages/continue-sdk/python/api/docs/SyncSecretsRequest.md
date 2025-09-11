# SyncSecretsRequest

## Properties

| Name               | Type             | Description                                      | Notes      |
| ------------------ | ---------------- | ------------------------------------------------ | ---------- |
| **fqsns**          | **List[object]** | Array of Fully Qualified Secret Names to resolve |
| **org_scope_id**   | **str**          | Organization ID to scope secret resolution to    | [optional] |
| **org_scope_slug** | **str**          | Organization slug to scope secret resolution to  | [optional] |

## Example

```python
from openapi_client.models.sync_secrets_request import SyncSecretsRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SyncSecretsRequest from a JSON string
sync_secrets_request_instance = SyncSecretsRequest.from_json(json)
# print the JSON string representation of the object
print(SyncSecretsRequest.to_json())

# convert the object into a dict
sync_secrets_request_dict = sync_secrets_request_instance.to_dict()
# create an instance of SyncSecretsRequest from a dict
sync_secrets_request_from_dict = SyncSecretsRequest.from_dict(sync_secrets_request_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
