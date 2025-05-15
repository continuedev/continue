# ListAssistants200ResponseInnerConfigResult


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**config** | **object** | The unrolled assistant configuration | 
**config_load_interrupted** | **bool** | Whether the configuration loading was interrupted | 
**errors** | **List[str]** | Any errors that occurred during configuration loading | [optional] 

## Example

```python
from openapi_client.models.list_assistants200_response_inner_config_result import ListAssistants200ResponseInnerConfigResult

# TODO update the JSON string below
json = "{}"
# create an instance of ListAssistants200ResponseInnerConfigResult from a JSON string
list_assistants200_response_inner_config_result_instance = ListAssistants200ResponseInnerConfigResult.from_json(json)
# print the JSON string representation of the object
print(ListAssistants200ResponseInnerConfigResult.to_json())

# convert the object into a dict
list_assistants200_response_inner_config_result_dict = list_assistants200_response_inner_config_result_instance.to_dict()
# create an instance of ListAssistants200ResponseInnerConfigResult from a dict
list_assistants200_response_inner_config_result_from_dict = ListAssistants200ResponseInnerConfigResult.from_dict(list_assistants200_response_inner_config_result_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


