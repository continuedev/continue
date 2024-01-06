"""
This file contains mechanisms for logging development data to files, SQL databases, and other formats.
"""


import json
from datetime import datetime
from typing import Any, Dict, Optional

import aiohttp

from .create_async_task import create_async_task
from .logging import logger
from .paths import getDevDataFilePath


class DevDataLogger:
    user_token: Optional[str] = None
    data_server_url: Optional[str] = None

    def setup(
        self, user_token: Optional[str] = None, data_server_url: Optional[str] = None
    ):
        self.user_token = user_token
        self.data_server_url = data_server_url

    def _to_data_server(self, table_name: str, data: Dict[str, Any]):
        async def _async_helper(self, table_name: str, data: Dict[str, Any]):
            if self.user_token is None or self.data_server_url is None:
                return

            async with aiohttp.ClientSession(trust_env=True) as session:
                await session.post(
                    f"{self.data_server_url}/event",
                    headers={"Authorization": f"Bearer {self.user_token}"},
                    json={
                        "table_name": table_name,
                        "data": data,
                        "user_token": self.user_token,
                    },
                )

        async def on_error(e: Exception):
            logger.warning(f"Failed to send dev data: {e}")

        create_async_task(
            _async_helper(self, table_name, data),
            on_error,
        )

    def _static_columns(self):
        return {
            "user_token": self.user_token or "NO_USER_TOKEN",
            "timestamp": datetime.now().isoformat(),
        }

    def _to_local(self, table_name: str, data: Dict[str, Any]):
        filepath = getDevDataFilePath(table_name)
        with open(filepath, "a") as f:
            json_line = json.dumps(data)
            f.write(f"{json_line}\n")

    def capture(self, table_name: str, data: Dict[str, Any]):
        try:
            data = {**self._static_columns(), **data}
            self._to_local(table_name, data)
            self._to_data_server(table_name, data)
        except Exception as e:
            logger.warning(f"Failed to capture dev data: {e}")


dev_data_logger = DevDataLogger()
