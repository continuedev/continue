import threading
from typing import Any, Dict, List, Optional, Union

import redbaron

from .paths import getConfigFilePath


def get_config_source():
    config_file_path = getConfigFilePath()
    with open(config_file_path, "r") as file:
        source_code = file.read()
    return source_code


def load_red():
    source_code = get_config_source()

    red = redbaron.RedBaron(source_code)
    return red


def get_config_node(red):
    for node in red:
        if node.type == "assignment" and node.target.value == "config":
            return node
    else:
        raise Exception("Config file appears to be improperly formatted")


def edit_property(
    args: redbaron.RedBaron, key_path: List[str], value: redbaron.RedBaron
):
    for i in range(len(args)):
        node = args[i]
        if node.type != "call_argument":
            continue

        if node.target.value == key_path[0]:
            if len(key_path) > 1:
                edit_property(node.value.value[1].value, key_path[1:], value)
            else:
                args[i].value = value
            return


edit_lock = threading.Lock()


def edit_config_property(
    key_path: List[str], value: Union[redbaron.RedBaron, str, float]
):
    """
    key_path: list of strings representing the path to the property
    value: redbaron node representing the value to set
    """
    if isinstance(value, str):
        value = create_string_node(value)
    elif isinstance(value, float):
        value = create_float_node(value)

    with edit_lock:
        red = load_red()
        config = get_config_node(red)
        config_args = config.value.value[1].value
        edit_property(config_args, key_path, value)

        with open(getConfigFilePath(), "w") as file:
            file.write(red.dumps())


def add_config_import(line: str):
    # check if the import already exists
    source = get_config_source()
    if line in source:
        return

    with edit_lock:
        red = load_red()
        # if it doesn't exist, add it
        red.insert(1, line)

        with open(getConfigFilePath(), "w") as file:
            file.write(red.dumps())


filtered_attrs = {
    "class_name",
    "name",
    "llm",
}

filtered_attrs_when_new = {"timeout", "prompt_templates"}


def escape_string(string: str) -> str:
    return string.replace('"', '\\"').replace("'", "\\'")


def display_val(v: Any, k: Optional[str] = None):
    if k == "template_messages":
        return v
    elif isinstance(v, str):
        return f'"{escape_string(v)}"'

    return str(v)


def is_default(llm, k, v):
    if k == "template_messages" and llm.__fields__[k].default is not None:
        return llm.__fields__[k].default.__name__ == v
    return v == llm.__fields__[k].default


def display_llm_class(llm, new: bool = False, overrides: Dict[str, str] = {}):
    sep = ",\n\t\t\t"
    args = sep.join(
        [
            f"{k}={display_val(v, k) if k not in overrides else overrides[k]}"
            for k, v in llm.dict().items()
            if k not in filtered_attrs and v is not None and not is_default(llm, k, v)
        ]
    )
    return f"{llm.__class__.__name__}(\n\t\t\t{args}\n\t\t)"


def create_obj_node(
    class_name: str, args: Dict[str, str], tabs: int = 1
) -> redbaron.RedBaron:
    args_list = [f"{key}={value}" for key, value in args.items()]
    t = "\t" * tabs
    new_line = "\n\t" + t
    sep = "," + new_line

    return redbaron.RedBaron(f"{class_name}({new_line}{sep.join(args_list)}\n{t})")[0]


def create_string_node(string: str) -> redbaron.RedBaron:
    string = escape_string(string)
    if "\n" in string:
        return redbaron.RedBaron(f'"""{string}"""')[0]
    return redbaron.RedBaron(f'"{string}"')[0]


def create_literal_node(literal: str) -> redbaron.RedBaron:
    return redbaron.RedBaron(literal)[0]


def create_bool_node(bool: bool) -> redbaron.RedBaron:
    return redbaron.RedBaron(str(bool))[0]


def create_float_node(float: float) -> redbaron.RedBaron:
    return redbaron.RedBaron(f"{float}")[0]


# Example:
# edit_config_property(
#     [
#         "models",
#         "default",
#     ],
#     create_obj_node("OpenAI", {"api_key": '""', "model": '"gpt-4"'}),
# )
