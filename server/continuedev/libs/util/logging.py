import logging
import os

from .paths import getLogFilePath

logfile_path = getLogFilePath()




    
logger = logging.getLogger("continue")
def getLogger(name=None):
    if name is None:
        return logger
    else:
        return logger.getChild(name)



class ConsoleFormatter(logging.Formatter):
    # Define your color scheme here
    COLORS = {
        'WARNING': '\033[93m',
        'INFO': '\033[92m',
        'DEBUG': '\033[94m',
        'CRITICAL': '\033[91m',
        'ERROR': '\033[91m',
        'ENDC': '\033[0m',
    }

    def format(self, record):
        # Ensuring levelname is exactly 7 characters
        formatted_levelname = f"{record.levelname[:7]:<7}"
        log_color = self.COLORS.get(record.levelname, self.COLORS['ENDC'])
        record.levelname = log_color + formatted_levelname + self.COLORS['ENDC']
        record.name = record.name.split('.')[-1]
        return super().format(record)
    
# make sure this only get called once per startup
if not logger.handlers:
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

    logger.setLevel(logging.DEBUG)

    # Create a file handler
    file_handler = logging.FileHandler(logfile_path)
    file_handler.setLevel(logging.DEBUG)

    # Create a console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)

    # Create a formatter
    formatter = logging.Formatter("[%(asctime)s] %(name)s [%(levelname)s] %(message)s")
    formatter.datefmt = "%Y-%m-%d %H:%M:%S"

    # Add the formatter to the handlers
    file_handler.setFormatter(formatter)

    # Correctly creating the colored formatter
    colored_formatter = ConsoleFormatter("[%(asctime)s] %(name)15.15s [%(levelname)s] %(message)s")
    colored_formatter.datefmt = "%H:%M:%S"

    # Now set this formatter to the console handler
    console_handler.setFormatter(colored_formatter)

    # Add the handlers to the logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)



