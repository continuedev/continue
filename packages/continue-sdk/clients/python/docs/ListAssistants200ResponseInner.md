# ListAssistants200ResponseInner


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**config_result** | [**ListAssistants200ResponseInnerConfigResult**](ListAssistants200ResponseInnerConfigResult.md) |  | 
**owner_slug** | **str** | Slug of the user or organization that owns the assistant | 
**package_slug** | **str** | Slug of the assistant package | 
**icon_url** | **str** | Pre-signed URL for the assistant&#39;s icon | [optional] 
**on_prem_proxy_url** | **str** | URL of the on-premises proxy if the organization uses one | [optional] 
**use_on_prem_proxy** | **bool** | Whether the organization uses an on-premises proxy | [optional] 
**raw_yaml** | **str** | Raw YAML configuration of the assistant | [optional] 

## Example

```python
from openapi_client.models.list_assistants200_response_inner import ListAssistants200ResponseInner

# TODO update the JSON string below
json = "{}"
# create an instance of ListAssistants200ResponseInner from a JSON string
list_assistants200_response_inner_instance = ListAssistants200ResponseInner.from_json(json)
# print the JSON string representation of the object
print(ListAssistants200ResponseInner.to_json())

# convert the object into a dict
list_assistants200_response_inner_dict = list_assistants200_response_inner_instance.to_dict()
# create an instance of ListAssistants200ResponseInner from a dict
list_assistants200_response_inner_from_dict = ListAssistants200ResponseInner.from_dict(list_assistants200_response_inner_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


