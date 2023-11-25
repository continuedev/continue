import logging
import os

from .paths import getGlobalFolderPath, getLogFilePath

import logging.config
import yaml


DEFAULT_LOG_CONFIG='''
version: 1
formatters:
  straight:
    format: '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
  simple:
    format: '%(asctime)s - %(name)20.20s - %(levelname)-7s - %(message)s'
    datefmt: '%H:%M:%S'
  json:
    (): pythonjsonlogger.jsonlogger.JsonFormatter
    format: '%(asctime)s %(name)s %(levelname)s %(message)s'
handlers:
  console:
    class: logging.StreamHandler
    level: DEBUG
    formatter: simple
    stream: ext://sys.stdout
  file:
    class: logging.FileHandler
    level: DEBUG
    formatter: straight
    filename: '{global_folder_path}/continue_server.log'
loggers:
  cont:
    level: DEBUG
    handlers: [console, file]
    propagate: False
root:
  level: DEBUG
  handlers: [file]
'''



# Load the config file
logging_config_path = os.path.join(getGlobalFolderPath(), "logging.yaml")

if not os.path.exists(logging_config_path):
    with open(logging_config_path, 'wt') as f:
        f.write(DEFAULT_LOG_CONFIG)

with open(logging_config_path, 'rt') as f:
    config = yaml.safe_load(f)

global_folder_path = getGlobalFolderPath()
config['handlers']['file']['filename'] = config['handlers']['file']['filename'].format(global_folder_path=global_folder_path)

# Configure the logging module with the config file
logging.config.dictConfig(config)

# Create a logger
logger = logging.getLogger("cont")

def getLogger(name=None):
    if name is None:
        return logger
    else:
        return logger.getChild(name)

