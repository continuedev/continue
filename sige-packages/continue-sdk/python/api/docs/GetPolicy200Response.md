# GetPolicy200Response

## Properties

| Name         | Type       | Description                                  | Notes      |
| ------------ | ---------- | -------------------------------------------- | ---------- |
| **policy**   | **object** | Organization policy configuration            | [optional] |
| **org_slug** | **str**    | Slug of the organization that has the policy | [optional] |

## Example

```python
from openapi_client.models.get_policy200_response import GetPolicy200Response

# TODO update the JSON string below
json = "{}"
# create an instance of GetPolicy200Response from a JSON string
get_policy200_response_instance = GetPolicy200Response.from_json(json)
# print the JSON string representation of the object
print(GetPolicy200Response.to_json())

# convert the object into a dict
get_policy200_response_dict = get_policy200_response_instance.to_dict()
# create an instance of GetPolicy200Response from a dict
get_policy200_response_from_dict = GetPolicy200Response.from_dict(get_policy200_response_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
