PYTHON_TRACEBACK_PREFIX = "Traceback (most recent call last):"


def get_python_traceback(output: str) -> str:
    if PYTHON_TRACEBACK_PREFIX in output:
        return PYTHON_TRACEBACK_PREFIX + output.split(PYTHON_TRACEBACK_PREFIX)[-1]
    elif "SyntaxError" in output:
        return "SyntaxError" + output.split("SyntaxError")[-1]
    else:
        return None


def get_javascript_traceback(output: str) -> str:
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
