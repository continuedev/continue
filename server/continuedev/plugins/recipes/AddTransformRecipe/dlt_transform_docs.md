# Customize resources

## Filter, transform and pivot data

You can attach any number of transformations that are evaluated on item per item basis to your resource. The available transformation types:

- map - transform the data item (resource.add_map)
- filter - filter the data item (resource.add_filter)
- yield map - a map that returns iterator (so single row may generate many rows - resource.add_yield_map)

Example: We have a resource that loads a list of users from an api endpoint. We want to customize it so:

- we remove users with user_id == 'me'
- we anonymize user data
  Here's our resource:

```python
import dlt

@dlt.resource(write_disposition='replace')
def users():
    ...
    users = requests.get(...)
    ...
    yield users
```

Here's our script that defines transformations and loads the data.

```python
from pipedrive import users

def anonymize_user(user_data):
    user_data['user_id'] = hash_str(user_data['user_id'])
    user_data['user_email'] = hash_str(user_data['user_email'])
    return user_data

# add the filter and anonymize function to users resource and enumerate
for user in users().add_filter(lambda user: user['user_id'] != 'me').add_map(anonymize_user):
print(user)
```

Here is a more complex example of a filter transformation:

    # Renaming columns
    ## Renaming columns by replacing the special characters

    In the example below, we create a dummy source with special characters in the name. We then write a function that we intend to apply to the resource to modify its output (i.e. replacing the German umlaut): replace_umlauts_in_dict_keys.
    ```python
    import dlt

    # create a dummy source with umlauts (special characters) in key names (um)
    @dlt.source
    def dummy_source(prefix: str = None):
        @dlt.resource
        def dummy_data():
            for _ in range(100):
                yield {f'Objekt_{_}':{'Größe':_, 'Äquivalenzprüfung':True}}
        return dummy_data(),

    def replace_umlauts_in_dict_keys(d):
        # Replaces umlauts in dictionary keys with standard characters.
        umlaut_map =  {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue'}
        result = {}
        for k, v in d.items():
            new_key = ''.join(umlaut_map.get(c, c) for c in k)
            if isinstance(v, dict):
                result[new_key] = replace_umlauts_in_dict_keys(v)
            else:
                result[new_key] = v
        return result

    # We can add the map function to the resource

    # 1. Create an instance of the source so you can edit it.
    data_source = dummy_source()

    # 2. Modify this source instance's resource
    data_source = data_source.dummy_data().add_map(replace_umlauts_in_dict_keys)

    # 3. Inspect your result
    for row in data_source:
        print(row)

    # {'Objekt_0': {'Groesse': 0, 'Aequivalenzpruefung': True}}
    # ...
    ```

Here is a more complex example of a map transformation:

# Pseudonymizing columns

## Pseudonymizing (or anonymizing) columns by replacing the special characters

Pseudonymization is a deterministic way to hide personally identifiable info (PII), enabling us to consistently achieve the same mapping. If instead you wish to anonymize, you can delete the data, or replace it with a constant. In the example below, we create a dummy source with a PII column called 'name', which we replace with deterministic hashes (i.e. replacing the German umlaut).

```python
import dlt
import hashlib

@dlt.source
def dummy_source(prefix: str = None):
    @dlt.resource
    def dummy_data():
        for _ in range(3):
            yield {'id':_, 'name': f'Jane Washington {_}'}
    return dummy_data(),

def pseudonymize_name(doc):
    Pseudonmyisation is a deterministic type of PII-obscuring
    Its role is to allow identifying users by their hash, without revealing the underlying info.

    # add a constant salt to generate
    salt = 'WI@N57%zZrmk#88c'
    salted_string = doc['name'] + salt
    sh = hashlib.sha256()
    sh.update(salted_string.encode())
    hashed_string = sh.digest().hex()
    doc['name'] = hashed_string
    return doc

    # run it as is
    for row in dummy_source().dummy_data().add_map(pseudonymize_name):
        print(row)

    #{'id': 0, 'name': '96259edb2b28b48bebce8278c550e99fbdc4a3fac8189e6b90f183ecff01c442'}
    #{'id': 1, 'name': '92d3972b625cbd21f28782fb5c89552ce1aa09281892a2ab32aee8feeb3544a1'}
    #{'id': 2, 'name': '443679926a7cff506a3b5d5d094dc7734861352b9e0791af5d39db5a7356d11a'}

    # Or create an instance of the data source, modify the resource and run the source.

    # 1. Create an instance of the source so you can edit it.
    data_source = dummy_source()
    # 2. Modify this source instance's resource
    data_source = data_source.dummy_data().add_map(replace_umlauts_in_dict_keys)
    # 3. Inspect your result
    for row in data_source:
        print(row)

    pipeline = dlt.pipeline(pipeline_name='example', destination='bigquery', dataset_name='normalized_data')
    load_info = pipeline.run(data_source)
```
