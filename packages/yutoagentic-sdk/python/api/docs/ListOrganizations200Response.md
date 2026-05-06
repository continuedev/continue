# ListOrganizations200Response

## Properties

| Name              | Type                                                                                                          | Description | Notes |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------- | ----- |
| **organizations** | [**List[ListOrganizations200ResponseOrganizationsInner]**](ListOrganizations200ResponseOrganizationsInner.md) |             |

## Example

```python
from openapi_client.models.list_organizations200_response import ListOrganizations200Response

# TODO update the JSON string below
json = "{}"
# create an instance of ListOrganizations200Response from a JSON string
list_organizations200_response_instance = ListOrganizations200Response.from_json(json)
# print the JSON string representation of the object
print(ListOrganizations200Response.to_json())

# convert the object into a dict
list_organizations200_response_dict = list_organizations200_response_instance.to_dict()
# create an instance of ListOrganizations200Response from a dict
list_organizations200_response_from_dict = ListOrganizations200Response.from_dict(list_organizations200_response_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
