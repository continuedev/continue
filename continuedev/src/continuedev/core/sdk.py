from abc import ABC, abstractmethod
from typing import Coroutine, Union
import os

from ..steps.core.core import Gpt35EditCodeStep
from ..models.main import Range
from .abstract_sdk import AbstractContinueSDK
from .config import ContinueConfig, load_config
from ..models.filesystem_edit import FileEdit, FileSystemEdit, AddFile, DeleteFile, AddDirectory, DeleteDirectory
from ..models.filesystem import RangeInFile
from ..libs.llm.hf_inference_api import HuggingFaceInferenceAPI
from ..libs.llm.openai import OpenAI
from .observation import Observation
from ..server.ide_protocol import AbstractIdeProtocolServer
from .main import Context, ContinueCustomException, History, Step
from ..steps.core.core import *


class Autopilot:
    pass


class ContinueSDKSteps:
    def __init__(self, sdk: "ContinueSDK"):
        self.sdk = sdk


class Models:
    def __init__(self, sdk: "ContinueSDK"):
        self.sdk = sdk

    async def starcoder(self):
        api_key = await self.sdk.get_user_secret(
            'HUGGING_FACE_TOKEN', 'Please add your Hugging Face token to the .env file')
        return HuggingFaceInferenceAPI(api_key=api_key)

    async def gpt35(self):
        api_key = await self.sdk.get_user_secret(
            'OPENAI_API_KEY', 'Please add your OpenAI API key to the .env file')
        return OpenAI(api_key=api_key, default_model="gpt-3.5-turbo")


class ContinueSDK(AbstractContinueSDK):
    """The SDK provided as parameters to a step"""
    ide: AbstractIdeProtocolServer
    steps: ContinueSDKSteps
    models: Models
    context: Context
    __autopilot: Autopilot

    def __init__(self, autopilot: Autopilot):
        self.ide = autopilot.ide
        self.__autopilot = autopilot
        self.steps = ContinueSDKSteps(self)
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

    async def run(self, commands: Union[List[str], str], cwd: str = None, name: str = None, description: str = None) -> Coroutine[str, None, None]:
        commands = commands if isinstance(commands, List) else [commands]
        return (await self.run_step(ShellCommandsStep(cmds=commands, cwd=cwd, description=description, **({'name': name} if name else {})))).text

    async def edit_file(self, filename: str, prompt: str, name: str = None, description: str = None, range: Range = None):
        filepath = await self._ensure_absolute_path(filename)

        await self.ide.setFileOpen(filepath)
        contents = await self.ide.readFile(filepath)
        await self.run_step(Gpt35EditCodeStep(
            range_in_files=[RangeInFile(filepath=filename, range=range) if range is not None else RangeInFile.from_entire_file(
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

    async def get_config(self) -> ContinueConfig:
        dir = await self.ide.getWorkspaceDirectory()
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
