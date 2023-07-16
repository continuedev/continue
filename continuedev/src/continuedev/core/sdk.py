import asyncio
from functools import cached_property
from typing import Coroutine, Dict, Union
import os

from ..steps.core.core import DefaultModelEditCodeStep
from ..models.main import Range
from .abstract_sdk import AbstractContinueSDK
from .config import ContinueConfig, load_config, load_global_config, update_global_config
from ..models.filesystem_edit import FileEdit, FileSystemEdit, AddFile, DeleteFile, AddDirectory, DeleteDirectory
from ..models.filesystem import RangeInFile
from ..libs.llm.hf_inference_api import HuggingFaceInferenceAPI
from ..libs.llm.openai import OpenAI
from ..libs.llm.ggml import GGML
from .observation import Observation
from ..server.ide_protocol import AbstractIdeProtocolServer
from .main import Context, ContinueCustomException, History, Step, ChatMessage
from ..steps.core.core import *
from ..libs.llm.proxy_server import ProxyServer


class Autopilot:
    pass


ModelProvider = Literal["openai", "hf_inference_api", "ggml", "anthropic"]
MODEL_PROVIDER_TO_ENV_VAR = {
    "openai": "OPENAI_API_KEY",
    "hf_inference_api": "HUGGING_FACE_TOKEN",
    "anthropic": "ANTHROPIC_API_KEY"
}


class Models:
    provider_keys: Dict[ModelProvider, str] = {}
    model_providers: List[ModelProvider]

    def __init__(self, sdk: "ContinueSDK", model_providers: List[ModelProvider]):
        self.sdk = sdk
        self.model_providers = model_providers

    @classmethod
    async def create(cls, sdk: "ContinueSDK", with_providers: List[ModelProvider] = ["openai"]) -> "Models":
        models = Models(sdk, with_providers)
        for provider in with_providers:
            if provider in MODEL_PROVIDER_TO_ENV_VAR:
                env_var = MODEL_PROVIDER_TO_ENV_VAR[provider]
                models.provider_keys[provider] = await sdk.get_user_secret(
                    env_var, f'Please add your {env_var} to the .env file')

        return models

    def __load_openai_model(self, model: str) -> OpenAI:
        api_key = self.provider_keys["openai"]
        if api_key == "":
            return ProxyServer(self.sdk.ide.unique_id, model)
        return OpenAI(api_key=api_key, default_model=model)

    def __load_hf_inference_api_model(self, model: str) -> HuggingFaceInferenceAPI:
        api_key = self.provider_keys["hf_inference_api"]
        return HuggingFaceInferenceAPI(api_key=api_key, model=model)

    @cached_property
    def starcoder(self):
        return self.__load_hf_inference_api_model("bigcode/starcoder")

    @cached_property
    def gpt35(self):
        return self.__load_openai_model("gpt-3.5-turbo")

    @cached_property
    def gpt350613(self):
        return self.__load_openai_model("gpt-3.5-turbo-0613")

    @cached_property
    def gpt3516k(self):
        return self.__load_openai_model("gpt-3.5-turbo-16k")

    @cached_property
    def gpt4(self):
        return self.__load_openai_model("gpt-4")

    @cached_property
    def ggml(self):
        return GGML()

    def __model_from_name(self, model_name: str):
        if model_name == "starcoder":
            return self.starcoder
        elif model_name == "gpt-3.5-turbo":
            return self.gpt35
        elif model_name == "gpt-3.5-turbo-16k":
            return self.gpt3516k
        elif model_name == "gpt-4":
            return self.gpt4
        elif model_name == "ggml":
            return self.ggml
        else:
            raise Exception(f"Unknown model {model_name}")

    @property
    def default(self):
        default_model = self.sdk.config.default_model
        return self.__model_from_name(default_model) if default_model is not None else self.gpt4


class ContinueSDK(AbstractContinueSDK):
    """The SDK provided as parameters to a step"""
    ide: AbstractIdeProtocolServer
    models: Models
    context: Context
    __autopilot: Autopilot

    def __init__(self, autopilot: Autopilot):
        self.ide = autopilot.ide
        self.__autopilot = autopilot
        self.context = autopilot.context
        self.config = self._load_config()

    @classmethod
    async def create(cls, autopilot: Autopilot) -> "ContinueSDK":
        sdk = ContinueSDK(autopilot)
        sdk.models = await Models.create(sdk)
        return sdk

    config: ContinueConfig

    def _load_config(self) -> ContinueConfig:
        dir = self.ide.workspace_directory
        yaml_path = os.path.join(dir, '.continue', 'config.yaml')
        json_path = os.path.join(dir, '.continue', 'config.json')
        if os.path.exists(yaml_path):
            return load_config(yaml_path)
        elif os.path.exists(json_path):
            return load_config(json_path)
        else:
            return load_global_config()

    @property
    def history(self) -> History:
        return self.__autopilot.history

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

    async def get_user_secret(self, env_var: str, prompt: str) -> str:
        return await self.ide.getUserSecret(env_var)

    def get_code_context(self, only_editing: bool = False) -> List[RangeInFileWithContents]:
        context = list(filter(lambda x: x.editing, self.__autopilot._highlighted_ranges)
                       ) if only_editing else self.__autopilot._highlighted_ranges
        return [c.range for c in context]

    def update_default_model(self, model: str):
        config = self.config
        config.default_model = model
        update_global_config(config)

    def set_loading_message(self, message: str):
        # self.__autopilot.set_loading_message(message)
        raise NotImplementedError()

    def raise_exception(self, message: str, title: str, with_step: Union[Step, None] = None):
        raise ContinueCustomException(message, title, with_step)

    async def get_chat_context(self) -> List[ChatMessage]:
        history_context = self.history.to_chat_history()
        highlighted_code = [
            hr.range for hr in self.__autopilot._highlighted_ranges]

        preface = "The following code is highlighted"

        # If no higlighted ranges, use first file as context
        if len(highlighted_code) == 0:
            preface = "The following file is open"
            visible_files = await self.ide.getVisibleFiles()
            if len(visible_files) > 0:
                content = await self.ide.readFile(visible_files[0])
                highlighted_code = [
                    RangeInFileWithContents.from_entire_file(visible_files[0], content)]

        for rif in highlighted_code:
            msg = ChatMessage(content=f"{preface} ({rif.filepath}):\n```\n{rif.contents}\n```",
                              role="system", summary=f"{preface}: {rif.filepath}")

            # Don't insert after latest user message or function call
            i = -1
            if len(history_context) > 0 and (history_context[i].role == "user" or history_context[i].role == "function"):
                i -= 1
            history_context.insert(i, msg)

        return history_context

    async def update_ui(self):
        await self.__autopilot.update_subscribers()

    async def clear_history(self):
        await self.__autopilot.clear_history()

    def current_step_was_deleted(self):
        return self.history.timeline[self.history.current_index].deleted
