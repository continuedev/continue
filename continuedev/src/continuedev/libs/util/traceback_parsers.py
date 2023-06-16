def get_python_traceback(output: str) -> str:
    if "Traceback (most recent call last):" in output or "SyntaxError" in output:
        return output
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
