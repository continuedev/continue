import os
from typing import Coroutine, Union

from .config import ContinueConfig, load_config
from ..models.filesystem_edit import FileSystemEdit, AddFile, DeleteFile, AddDirectory, DeleteDirectory
from ..models.filesystem import RangeInFile
from ..libs.llm import LLM
from ..libs.llm.hf_inference_api import HuggingFaceInferenceAPI
from ..libs.llm.openai import OpenAI
from .observation import Observation
from ..server.ide_protocol import AbstractIdeProtocolServer
from .main import History, Step
from ..libs.steps.core.core import *
from .env import get_env_var, save_env_var


class Agent:
    pass


class ContinueSDKSteps:
    def __init__(self, sdk: "ContinueSDK"):
        self.sdk = sdk


class Models:
    def __init__(self, sdk: "ContinueSDK"):
        self.sdk = sdk

    async def starcoder(self):
        api_key = await self.sdk.get_user_secret(
            'HUGGING_FACE_TOKEN', 'Please enter your Hugging Face token')
        return HuggingFaceInferenceAPI(api_key=api_key)

    async def gpt35(self):
        api_key = await self.sdk.get_user_secret(
            'OPENAI_API_KEY', 'Please enter your OpenAI API key')
        return OpenAI(api_key=api_key, default_model="gpt-3.5-turbo")


class ContinueSDK:
    """The SDK provided as parameters to a step"""
    ide: AbstractIdeProtocolServer
    steps: ContinueSDKSteps
    models: Models
    __agent: Agent

    def __init__(self, agent: Agent):
        self.ide = agent.ide
        self.__agent = agent
        self.steps = ContinueSDKSteps(self)
        self.models = Models(self)

    @property
    def history(self) -> History:
        return self.__agent.history

    async def _ensure_absolute_path(self, path: str) -> str:
        if os.path.isabs(path):
            return path
        return os.path.join(await self.ide.getWorkspaceDirectory(), path)

    async def run_step(self, step: Step) -> Coroutine[Observation, None, None]:
        return await self.__agent._run_singular_step(step)

    async def apply_filesystem_edit(self, edit: FileSystemEdit):
        return await self.run_step(FileSystemEditStep(edit=edit))

    async def wait_for_user_input(self) -> str:
        return await self.__agent.wait_for_user_input()

    async def wait_for_user_confirmation(self, prompt: str):
        return await self.run_step(WaitForUserConfirmationStep(prompt=prompt))

    async def run(self, commands: List[str] | str, cwd: str = None):
        commands = commands if isinstance(commands, List) else [commands]
        return await self.run_step(ShellCommandsStep(commands=commands, cwd=cwd))

    async def edit_file(self, filename: str, prompt: str):
        filepath = await self._ensure_absolute_path(filename)

        await self.ide.setFileOpen(filepath)
        contents = await self.ide.readFile(filepath)
        await self.run_step(EditCodeStep(
            range_in_files=[RangeInFile.from_entire_file(filepath, contents)],
            prompt=f'Here is the code before:\n\n{{code}}\n\nHere is the user request:\n\n{prompt}\n\nHere is the code edited to perfectly solve the user request:\n\n'
        ))

    async def add_file(self, filename: str, content: str | None):
        return await self.run_step(FileSystemEditStep(edit=AddFile(filename=filename, content=content)))

    async def delete_file(self, filename: str):
        return await self.run_step(FileSystemEditStep(edit=DeleteFile(filepath=filename)))

    async def add_directory(self, path: str):
        return await self.run_step(FileSystemEditStep(edit=AddDirectory(path=path)))

    async def delete_directory(self, path: str):
        return await self.run_step(FileSystemEditStep(edit=DeleteDirectory(path=path)))

    async def get_user_secret(self, env_var: str, prompt: str) -> str:
        try:
            val = get_env_var(env_var)
            if val is not None:
                return val
        except:
            pass
        val = (await self.run_step(WaitForUserInputStep(prompt=prompt))).text
        save_env_var(env_var, val)
        return val

    async def get_config(self) -> ContinueConfig:
        dir = await self.ide.getWorkspaceDirectory()
        yaml_path = os.path.join(dir, 'continue.yaml')
        json_path = os.path.join(dir, 'continue.json')
        if os.path.exists(yaml_path):
            return load_config(yaml_path)
        elif os.path.exists(json_path):
            return load_config(json_path)
        else:
            return ContinueConfig()

    def set_loading_message(self, message: str):
        # self.__agent.set_loading_message(message)
        raise NotImplementedError()
