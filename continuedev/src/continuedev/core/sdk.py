import traceback
from typing import Coroutine, Union
import os
import importlib

from ..plugins.steps.core.core import DefaultModelEditCodeStep
from ..models.main import Range
from .abstract_sdk import AbstractContinueSDK
from .config import ContinueConfig
from ..models.filesystem_edit import FileEdit, FileSystemEdit, AddFile, DeleteFile, AddDirectory, DeleteDirectory
from ..models.filesystem import RangeInFile
from ..libs.llm import LLM
from .observation import Observation
from ..server.ide_protocol import AbstractIdeProtocolServer
from .main import Context, ContinueCustomException, History, HistoryNode, Step, ChatMessage
from ..plugins.steps.core.core import *
from ..libs.util.telemetry import posthog_logger
from ..libs.util.paths import getConfigFilePath
from .models import Models
from ..libs.util.logging import logger


class Autopilot:
    pass


class ContinueSDK(AbstractContinueSDK):
    """The SDK provided as parameters to a step"""
    ide: AbstractIdeProtocolServer
    models: Models
    context: Context
    config: ContinueConfig
    __autopilot: Autopilot

    def __init__(self, autopilot: Autopilot):
        self.ide = autopilot.ide
        self.__autopilot = autopilot
        self.context = autopilot.context

    @classmethod
    async def create(cls, autopilot: Autopilot) -> "ContinueSDK":
        sdk = ContinueSDK(autopilot)
        autopilot.continue_sdk = sdk

        try:
            config = sdk._load_config_dot_py()
            sdk.config = config
        except Exception as e:
            logger.error(f"Failed to load config.py: {e}")

            sdk.config = ContinueConfig(
            ) if sdk._last_valid_config is None else sdk._last_valid_config

            formatted_err = '\n'.join(traceback.format_exception(e))
            msg_step = MessageStep(
                name="Invalid Continue Config File", message=formatted_err)
            msg_step.description = f"Falling back to default config settings.\n```\n{formatted_err}\n```\n\nIt's possible this error was caused by an update to the Continue config format. If you'd like to see the new recommended default `config.py`, check [here](https://github.com/continuedev/continue/blob/main/continuedev/src/continuedev/libs/constants/default_config.py)."
            sdk.history.add_node(HistoryNode(
                step=msg_step,
                observation=None,
                depth=0,
                active=False
            ))

        sdk.models = sdk.config.models
        await sdk.models.start(sdk)

        # When the config is loaded, setup posthog logger
        posthog_logger.setup(
            sdk.ide.unique_id, sdk.config.allow_anonymous_telemetry)

        return sdk

    @property
    def history(self) -> History:
        return self.__autopilot.history

    def write_log(self, message: str):
        self.history.timeline[self.history.current_index].logs.append(message)

    async def start_model(self, llm: LLM):
        kwargs = {}
        if llm.requires_api_key:
            kwargs["api_key"] = await self.get_user_secret(llm.requires_api_key)
        if llm.requires_unique_id:
            kwargs["unique_id"] = self.ide.unique_id
        if llm.requires_write_log:
            kwargs["write_log"] = self.write_log
        await llm.start(**kwargs)

    async def _ensure_absolute_path(self, path: str) -> str:
        if os.path.isabs(path):
            return path

        # Else if in workspace
        workspace_path = os.path.join(self.ide.workspace_directory, path)
        if os.path.exists(workspace_path):
            return workspace_path
        else:
            # Check if it matches any of the open files, then use that absolute path
            open_files = await self.ide.getOpenFiles()
            for open_file in open_files:
                if os.path.basename(open_file) == os.path.basename(path):
                    return open_file
            raise Exception(f"Path {path} does not exist")

    async def run_step(self, step: Step) -> Coroutine[Observation, None, None]:
        return await self.__autopilot._run_singular_step(step)

    async def apply_filesystem_edit(self, edit: FileSystemEdit, name: str = None, description: str = None):
        return await self.run_step(FileSystemEditStep(edit=edit, description=description, **({'name': name} if name else {})))

    async def wait_for_user_input(self) -> str:
        return await self.__autopilot.wait_for_user_input()

    async def wait_for_user_confirmation(self, prompt: str):
        return await self.run_step(WaitForUserConfirmationStep(prompt=prompt))

    async def run(self, commands: Union[List[str], str], cwd: str = None, name: str = None, description: str = None, handle_error: bool = True) -> Coroutine[str, None, None]:
        commands = commands if isinstance(commands, List) else [commands]
        return (await self.run_step(ShellCommandsStep(cmds=commands, cwd=cwd, description=description, handle_error=handle_error, **({'name': name} if name else {})))).text

    async def edit_file(self, filename: str, prompt: str, name: str = None, description: str = "", range: Range = None):
        filepath = await self._ensure_absolute_path(filename)

        await self.ide.setFileOpen(filepath)
        contents = await self.ide.readFile(filepath)
        await self.run_step(DefaultModelEditCodeStep(
            range_in_files=[RangeInFile(filepath=filepath, range=range) if range is not None else RangeInFile.from_entire_file(
                filepath, contents)],
            user_input=prompt,
            description=description,
            **({'name': name} if name else {})
        ))

    async def append_to_file(self, filename: str, content: str):
        filepath = await self._ensure_absolute_path(filename)
        previous_content = await self.ide.readFile(filepath)
        file_edit = FileEdit.from_append(filepath, previous_content, content)
        await self.ide.applyFileSystemEdit(file_edit)

    async def add_file(self, filename: str, content: Union[str, None]):
        filepath = await self._ensure_absolute_path(filename)
        dir_name = os.path.dirname(filepath)
        os.makedirs(dir_name, exist_ok=True)
        return await self.run_step(FileSystemEditStep(edit=AddFile(filepath=filepath, content=content)))

    async def delete_file(self, filename: str):
        filename = await self._ensure_absolute_path(filename)
        return await self.run_step(FileSystemEditStep(edit=DeleteFile(filepath=filename)))

    async def add_directory(self, path: str):
        path = await self._ensure_absolute_path(path)
        return await self.run_step(FileSystemEditStep(edit=AddDirectory(path=path)))

    async def delete_directory(self, path: str):
        path = await self._ensure_absolute_path(path)
        return await self.run_step(FileSystemEditStep(edit=DeleteDirectory(path=path)))

    async def get_user_secret(self, env_var: str) -> str:
        # TODO support error prompt dynamically set on env_var
        return await self.ide.getUserSecret(env_var)

    _last_valid_config: ContinueConfig = None

    def _load_config_dot_py(self) -> ContinueConfig:
        # Read the file content
        with open(os.path.expanduser('~/.continue/config.py')) as file:
            config_content = file.read()

        def load_module(module_name: str, class_names: List[str]):
            # from anthropic import AsyncAnthropic
            module = importlib.import_module(module_name)
            for class_name in class_names:
                globals()[class_name] = getattr(module, class_name)

        while True:
            # Execute the file content
            locals_var = {}
            try:
                import importlib.util
                spec = importlib.util.spec_from_file_location(
                    "config", "/Users/natesesti/.continue/config.py")
                config = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(config)

                return config.config
                # exec(config_content, globals(), locals_var)
                # print("Done executing, ", locals_var)
                # return locals_var['config']
            except ModuleNotFoundError as e:
                print("ModuleNotFoundError")
                print(e)
                print(traceback.format_exception(e))
                formatted = traceback.format_exception(e)
                line = formatted[-2].split("\n")[-2].strip().split()
                # Parse the module name and class name from the error message
                # Example: ModuleNotFoundError: No module named 'continuedev.src.continuedev.plugins.context_providers.google'

                # Get the module name
                module_name = line[1]
                # Get the class name
                class_names = list(map(lambda x: x.replace(",", ""), filter(lambda x: x.strip() != "", line[3:])))

                # Load the module
                print(
                    f"Loading module {module_name} with class names {class_names}")
                load_module(module_name, class_names)
            except Exception as e:
                print("Failed to execute config.py: ", e)
                raise e

        # Use importlib to load the config file config.py at the given path
        path = getConfigFilePath()

        import importlib.util
        spec = importlib.util.spec_from_file_location("config", path)
        config = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(config)
        self._last_valid_config = config.config

        return config.config

    def get_code_context(self, only_editing: bool = False) -> List[RangeInFileWithContents]:
        highlighted_ranges = self.__autopilot.context_manager.context_providers[
            "code"].highlighted_ranges
        context = list(filter(lambda x: x.item.editing, highlighted_ranges)
                       ) if only_editing else highlighted_ranges
        return [c.rif for c in context]

    def set_loading_message(self, message: str):
        # self.__autopilot.set_loading_message(message)
        raise NotImplementedError()

    def raise_exception(self, message: str, title: str, with_step: Union[Step, None] = None):
        raise ContinueCustomException(message, title, with_step)

    async def get_chat_context(self) -> List[ChatMessage]:
        history_context = self.history.to_chat_history()

        context_messages: List[ChatMessage] = await self.__autopilot.context_manager.get_chat_messages()

        # Insert at the end, but don't insert after latest user message or function call
        i = -2 if (len(history_context) > 0 and (
            history_context[-1].role == "user" or history_context[-1].role == "function")) else -1
        for msg in context_messages:
            history_context.insert(i, msg)

        return history_context

    async def update_ui(self):
        await self.__autopilot.update_subscribers()

    async def clear_history(self):
        await self.__autopilot.clear_history()

    def current_step_was_deleted(self):
        return self.history.timeline[self.history.current_index].deleted
