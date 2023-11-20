import traceback


class SessionNotFound(Exception):
    pass


def format_exc(e: Exception) -> str:
    lines = traceback.format_exception(Exception, e, e.__traceback__)
    return "\n".join(lines)
