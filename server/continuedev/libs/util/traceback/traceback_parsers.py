from typing import Optional

from boltons import tbutils

from ....models.main import Traceback

PYTHON_TRACEBACK_PREFIX = "Traceback (most recent call last):"


def get_python_traceback(output: str) -> Optional[str]:
    if PYTHON_TRACEBACK_PREFIX in output:
        tb_string = output.split(PYTHON_TRACEBACK_PREFIX)[-1]

        # Then need to remove any lines below the traceback. Do this by noticing that
        # the last line of the traceback is the first (other than they prefix) that doesn't begin with whitespace
        lines = list(filter(lambda x: x.strip() != "", tb_string.splitlines()))
        for i in range(len(lines) - 1):
            if not lines[i].startswith(" "):
                tb_string = "\n".join(lines[: i + 1])
                break

        return PYTHON_TRACEBACK_PREFIX + "\n" + tb_string
    elif "SyntaxError" in output:
        return "SyntaxError" + output.split("SyntaxError")[-1]
    else:
        return None


def get_javascript_traceback(output: str) -> Optional[str]:
    lines = output.splitlines()
    first_line = None
    for i in range(len(lines) - 1):
        segs = lines[i].split(":")
        if (
            len(segs) > 1
            and segs[0] != ""
            and segs[1].startswith(" ")
            and lines[i + 1].strip().startswith("at")
        ):
            first_line = lines[i]
            break

    if first_line is not None:
        return "\n".join(lines[lines.index(first_line) :])
    else:
        return None


def parse_python_traceback(tb_string: str) -> Traceback:
    # Remove anchor lines - tbutils doesn't always get them right
    tb_string = "\n".join(
        filter(
            lambda x: x.strip().replace("~", "").replace("^", "") != "",
            tb_string.splitlines(),
        )
    )
    exc = tbutils.ParsedException.from_string(tb_string)
    return Traceback.from_tbutil_parsed_exc(exc)
