# GetFreeTrialStatus200Response

## Properties

| Name                       | Type      | Description                                                   | Notes      |
| -------------------------- | --------- | ------------------------------------------------------------- | ---------- |
| **opted_in_to_free_trial** | **bool**  | Whether the user has opted into the free trial                |
| **chat_count**             | **float** | Current number of chat messages used                          | [optional] |
| **autocomplete_count**     | **float** | Current number of autocomplete requests used                  | [optional] |
| **chat_limit**             | **float** | Maximum number of chat messages allowed in free trial         |
| **autocomplete_limit**     | **float** | Maximum number of autocomplete requests allowed in free trial |

## Example

```python
from openapi_client.models.get_free_trial_status200_response import GetFreeTrialStatus200Response

# TODO update the JSON string below
json = "{}"
# create an instance of GetFreeTrialStatus200Response from a JSON string
get_free_trial_status200_response_instance = GetFreeTrialStatus200Response.from_json(json)
# print the JSON string representation of the object
print(GetFreeTrialStatus200Response.to_json())

# convert the object into a dict
get_free_trial_status200_response_dict = get_free_trial_status200_response_instance.to_dict()
# create an instance of GetFreeTrialStatus200Response from a dict
get_free_trial_status200_response_from_dict = GetFreeTrialStatus200Response.from_dict(get_free_trial_status200_response_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
