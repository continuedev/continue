import asyncio
from functools import cached_property
from typing import Coroutine, Union
import os

from ..steps.core.core import DefaultModelEditCodeStep
from ..models.main import Range
from .abstract_sdk import AbstractContinueSDK
from .config import ContinueConfig, load_config
from ..models.filesystem_edit import FileEdit, FileSystemEdit, AddFile, DeleteFile, AddDirectory, DeleteDirectory
from ..models.filesystem import RangeInFile
from ..libs.llm.hf_inference_api import HuggingFaceInferenceAPI
from ..libs.llm.openai import OpenAI
from .observation import Observation
from ..server.ide_protocol import AbstractIdeProtocolServer
from .main import Context, ContinueCustomException, History, Step, ChatMessage, ChatMessageRole
from ..steps.core.core import *
from ..libs.llm.proxy_server import ProxyServer


class Autopilot:
    pass


class Models:
    def __init__(self, sdk: "ContinueSDK"):
        self.sdk = sdk

    @cached_property
    def starcoder(self):
        async def load_starcoder():
            api_key = await self.sdk.get_user_secret(
                'HUGGING_FACE_TOKEN', 'Please add your Hugging Face token to the .env file')
            return HuggingFaceInferenceAPI(api_key=api_key)
        return asyncio.get_event_loop().run_until_complete(load_starcoder())

    @cached_property
    def gpt35(self):
        async def load_gpt35():
            api_key = await self.sdk.get_user_secret(
                'OPENAI_API_KEY', 'Enter your OpenAI API key, OR press enter to try for free')
            if api_key == "":
                return ProxyServer(self.sdk.ide.unique_id, "gpt-3.5-turbo")
            return OpenAI(api_key=api_key, default_model="gpt-3.5-turbo")
        return asyncio.get_event_loop().run_until_complete(load_gpt35())

    @cached_property
    def gpt4(self):
        async def load_gpt4():
            api_key = await self.sdk.get_user_secret(
                'OPENAI_API_KEY', 'Enter your OpenAI API key, OR press enter to try for free')
            if api_key == "":
                return ProxyServer(self.sdk.ide.unique_id, "gpt-4")
            return OpenAI(api_key=api_key, default_model="gpt-4")
        return asyncio.get_event_loop().run_until_complete(load_gpt4())

    def __model_from_name(self, model_name: str):
        if model_name == "starcoder":
            return self.starcoder
        elif model_name == "gpt-3.5-turbo":
            return self.gpt35
        elif model_name == "gpt-4":
            return self.gpt4
        else:
            raise Exception(f"Unknown model {model_name}")

    @cached_property
    def default(self):
        default_model = self.sdk.config.default_model
        return self.__model_from_name(default_model) if default_model is not None else self.gpt35


class ContinueSDK(AbstractContinueSDK):
    """The SDK provided as parameters to a step"""
    ide: AbstractIdeProtocolServer
    models: Models
    context: Context
    __autopilot: Autopilot

    def __init__(self, autopilot: Autopilot):
        self.ide = autopilot.ide
        self.__autopilot = autopilot
        self.models = Models(self)
        self.context = autopilot.context

    @property
    def history(self) -> History:
        return self.__autopilot.history

    async def _ensure_absolute_path(self, path: str) -> str:
        if os.path.isabs(path):
            return path
        return os.path.join(await self.ide.getWorkspaceDirectory(), path)

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

    async def edit_file(self, filename: str, prompt: str, name: str = None, description: str = None, range: Range = None):
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
        return await self.run_step(FileSystemEditStep(edit=AddFile(filepath=filepath, content=content)))

    async def delete_file(self, filename: str):
        filepath = await self._ensure_absolute_path(filename)
        return await self.run_step(FileSystemEditStep(edit=DeleteFile(filepath=filename)))

    async def add_directory(self, path: str):
        filepath = await self._ensure_absolute_path(path)
        return await self.run_step(FileSystemEditStep(edit=AddDirectory(path=path)))

    async def delete_directory(self, path: str):
        filepath = await self._ensure_absolute_path(path)
        return await self.run_step(FileSystemEditStep(edit=DeleteDirectory(path=path)))

    async def get_user_secret(self, env_var: str, prompt: str) -> str:
        return await self.ide.getUserSecret(env_var)

    @property
    def config(self) -> ContinueConfig:
        dir = self.ide.workspace_directory
        yaml_path = os.path.join(dir, '.continue', 'config.yaml')
        json_path = os.path.join(dir, '.continue', 'config.json')
        if os.path.exists(yaml_path):
            return load_config(yaml_path)
        elif os.path.exists(json_path):
            return load_config(json_path)
        else:
            return ContinueConfig()

    def set_loading_message(self, message: str):
        # self.__autopilot.set_loading_message(message)
        raise NotImplementedError()

    def raise_exception(self, message: str, title: str, with_step: Union[Step, None] = None):
        raise ContinueCustomException(message, title, with_step)

    def add_chat_context(self, content: str, summary: Union[str, None] = None, role: ChatMessageRole = "assistant"):
        self.history.timeline[self.history.current_index].step.chat_context.append(
            ChatMessage(content=content, role=role, summary=summary))

    async def get_chat_context(self) -> List[ChatMessage]:
        history_context = self.history.to_chat_history()
        highlighted_code = await self.ide.getHighlightedCode()

        preface = "The following code is highlighted"

        if len(highlighted_code) == 0:
            preface = "The following file is open"
            # Get the full contents of all open files
            files = await self.ide.getOpenFiles()
            if len(files) > 0:
                content = await self.ide.readFile(files[0])
                highlighted_code = [
                    RangeInFile.from_entire_file(files[0], content)]

        for rif in highlighted_code:
            code = await self.ide.readRangeInFile(rif)
            history_context.append(ChatMessage(
                content=f"{preface} ({rif.filepath}):\n```\n{code}\n```", role="user", summary=f"{preface}: {rif.filepath}"))
        return history_context

    async def update_ui(self):
        await self.__autopilot.update_subscribers()

    async def clear_history(self):
        await self.__autopilot.clear_history()
