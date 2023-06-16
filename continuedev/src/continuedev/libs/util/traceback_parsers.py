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
    if len(lines) > 0:
        first_line = lines[0].split(": ")
        if len(lines) > 1 and len(first_line) > 0 and len(first_line[0]) > 0 and "at" in lines[1].lstrip():
            return output
    else:
        return None
