from typing import Union
from ...models.main import Traceback
from boltons import tbutils


def sort_func(items):
    """Sort a list of items."""
    return sorted(items)


def parse_python_traceback(stdout: str) -> Union[Traceback, None]:
    """Parse a python traceback from stdout."""

    # Sometimes paths are not quoted, but they need to be
    if "File \"" not in stdout:
        stdout = stdout.replace("File ", "File \"").replace(
            ", line ", "\", line ")

    try:
        tbutil_parsed_exc = tbutils.ParsedException.from_string(stdout)
        return Traceback.from_tbutil_parsed_exc(tbutil_parsed_exc)

    except Exception:
        return None
