import logging
import os

from .paths import getLogFilePath

logfile_path = getLogFilePath()

try:
    # Truncate the logs that are more than a day old
    if os.path.exists(logfile_path) and os.path.getsize(logfile_path) > 32 * 1024:
        tail = None
        with open(logfile_path, "rb") as f:
            f.seek(-32 * 1024, os.SEEK_END)
            tail = f.read().decode("utf-8")

        if tail is not None:
            with open(logfile_path, "w") as f:
                f.write(tail)

except Exception as e:
    print("Error truncating log file: {}".format(e))

# Create a logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Create a file handler
file_handler = logging.FileHandler(logfile_path)
file_handler.setLevel(logging.DEBUG)

# Create a console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)

# Create a formatter
formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s")
formatter.datefmt = "%Y-%m-%d %H:%M:%S"

# Add the formatter to the handlers
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# Add the handlers to the logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)
