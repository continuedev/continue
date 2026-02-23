# GetAssistant200Response

## Properties

| Name                  | Type                                                                                            | Description                                               | Notes      |
| --------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| **config_result**     | [**ListAssistants200ResponseInnerConfigResult**](ListAssistants200ResponseInnerConfigResult.md) |                                                           |
| **owner_slug**        | **str**                                                                                         | Slug of the user or organization that owns the agent  |
| **package_slug**      | **str**                                                                                         | Slug of the agent package                             |
| **icon_url**          | **str**                                                                                         | Pre-signed URL for the agent&#39;s icon               | [optional] |
| **on_prem_proxy_url** | **str**                                                                                         | URL of the on-premises proxy if the organization uses one | [optional] |
| **use_on_prem_proxy** | **bool**                                                                                        | Whether the organization uses an on-premises proxy        | [optional] |
| **raw_yaml**          | **str**                                                                                         | Raw YAML configuration of the agent                   | [optional] |

## Example

```python
from openapi_client.models.get_assistant200_response import GetAssistant200Response

# TODO update the JSON string below
json = "{}"
# create an instance of GetAssistant200Response from a JSON string
get_assistant200_response_instance = GetAssistant200Response.from_json(json)
# print the JSON string representation of the object
print(GetAssistant200Response.to_json())

# convert the object into a dict
get_assistant200_response_dict = get_assistant200_response_instance.to_dict()
# create an instance of GetAssistant200Response from a dict
get_assistant200_response_from_dict = GetAssistant200Response.from_dict(get_assistant200_response_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
