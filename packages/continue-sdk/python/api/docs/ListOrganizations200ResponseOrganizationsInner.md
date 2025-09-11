# ListOrganizations200ResponseOrganizationsInner

## Properties

| Name         | Type    | Description                                    | Notes      |
| ------------ | ------- | ---------------------------------------------- | ---------- |
| **id**       | **str** | Organization ID                                |
| **name**     | **str** | Organization name                              |
| **icon_url** | **str** | Pre-signed URL for the organization&#39;s icon | [optional] |
| **slug**     | **str** | Organization slug                              |

## Example

```python
from openapi_client.models.list_organizations200_response_organizations_inner import ListOrganizations200ResponseOrganizationsInner

# TODO update the JSON string below
json = "{}"
# create an instance of ListOrganizations200ResponseOrganizationsInner from a JSON string
list_organizations200_response_organizations_inner_instance = ListOrganizations200ResponseOrganizationsInner.from_json(json)
# print the JSON string representation of the object
print(ListOrganizations200ResponseOrganizationsInner.to_json())

# convert the object into a dict
list_organizations200_response_organizations_inner_dict = list_organizations200_response_organizations_inner_instance.to_dict()
# create an instance of ListOrganizations200ResponseOrganizationsInner from a dict
list_organizations200_response_organizations_inner_from_dict = ListOrganizations200ResponseOrganizationsInner.from_dict(list_organizations200_response_organizations_inner_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
