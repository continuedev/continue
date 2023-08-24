import threading
from typing import Dict, List

import redbaron

from .paths import getConfigFilePath


def load_red():
    config_file_path = getConfigFilePath()
    with open(config_file_path, "r") as file:
        source_code = file.read()

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


def edit_config_property(key_path: List[str], value: redbaron.RedBaron):
    with edit_lock:
        red = load_red()
        config = get_config_node(red)
        config_args = config.value.value[1].value
        edit_property(config_args, key_path, value)

        with open(getConfigFilePath(), "w") as file:
            file.write(red.dumps())


def create_obj_node(class_name: str, args: Dict[str, str]) -> redbaron.RedBaron:
    args = [f"{key}={value}" for key, value in args.items()]
    return redbaron.RedBaron(f"{class_name}({', '.join(args)})")[0]


def create_string_node(string: str) -> redbaron.RedBaron:
    return redbaron.RedBaron(f'"{string}"')[0]


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
