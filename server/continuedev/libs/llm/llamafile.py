import asyncio
import socket
import subprocess
from typing import List, Optional

from continuedev.core.main import ChatMessage, ContinueCustomException
from continuedev.models.llm import CompletionOptions

from .llamacpp import LlamaCpp


def test_port(PORT):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("", PORT))  ## Try to open port
    except OSError as e:
        if e.errno == 98:  ## Errorno 98 means address already bound
            return True
        elif e.errno == 48:  ## Errorno 48 means address already in use
            return True
        return False
    s.close()
    return False


STARTUP_DELAY = 3.0


class Llamafile(LlamaCpp):
    """
    A [llamafile](https://github.com/Mozilla-Ocho/llamafile#readme) is a self-contained binary that can run an open-source LLM. You can configure this provider in your config.json as follows:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "Llamafile",
            "provider": "llamafile",
            "model": "mistral-7b",
        }]
    }
    ```

    Optionally, you can set the `llamafile_command` property, which will be run to start the llamafile if it isn't already running on port 8080. Be sure to use an absolute path to the llamafile binary. For example: `/Users/yourusername/mistral-7b-instruct-v0.1-Q4_K_M-server.llamafile`.
    """

    llamafile_command: Optional[str] = None

    llamafile_process: Optional[subprocess.Popen] = None

    def check_and_start(self, should_raise: bool) -> bool:
        # Try to start the llamafile if it's not already started on port 8080
        if not self.llamafile_command:
            return False

        port = int((self.api_base or ":8080").split(":")[-1])

        if not test_port(port):
            if should_raise and self.llamafile_process:
                # If already tried to start and it isn't started, raise an exception
                _, err = self.llamafile_process.communicate()
                err = err.decode("utf-8") if err else ""
                err_string = f"Error starting llamafile\n\n{err}"
                raise ContinueCustomException(err_string, err_string)

            import threading

            def process_run():
                p = subprocess.Popen(
                    self.llamafile_command.split(" "),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    close_fds=True,
                    start_new_session=True,
                    shell=True,
                )
                self.llamafile_process = p

            t = threading.Thread(target=process_run)
            t.start()

            return True

        return False

    def start(self, unique_id: str | None = None):
        super().start(unique_id)
        self.check_and_start(False)

    def dict(self, **kwargs):
        d = super().dict(**kwargs)
        if "llamafile_process" in d:
            del d["llamafile_process"]

        return d

    async def _stream_chat(
        self, messages: List[ChatMessage], options: CompletionOptions
    ):
        if self.check_and_start(True):
            await asyncio.sleep(STARTUP_DELAY)

        async for message in super()._stream_chat(messages, options):
            yield message

    async def _stream_complete(self, prompt, options):
        if self.check_and_start(True):
            await asyncio.sleep(STARTUP_DELAY)

        async for message in super()._stream_complete(prompt, options):
            yield message

    async def _complete(self, prompt: str, options: CompletionOptions):
        if self.check_and_start(True):
            await asyncio.sleep(STARTUP_DELAY)

        return await super()._complete(prompt, options)
