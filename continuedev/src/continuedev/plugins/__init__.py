from typing import List
import pluggy
from .step import hookspecs
from .step.libs import hello_world

builtin_libs = [hello_world]

def get_plugin_manager(use_plugins: List[str]) -> pluggy.PluginManager:
    pm = pluggy.PluginManager("continue.step")
    pm.add_hookspecs(hookspecs)
    pm.load_setuptools_entrypoints("continue.step")

    # Only use plugins that are specified in the config file
    for plugin, name in pm.list_name_plugin():
        if name not in use_plugins:
            pm.set_blocked(plugin)
    
    # Print warning if plugin not found
    for name in use_plugins:
        if not pm.has_plugin(name):
            print(f"Plugin {name} not found.")

    for lib in builtin_libs:
        pm.register(lib)

    return pm