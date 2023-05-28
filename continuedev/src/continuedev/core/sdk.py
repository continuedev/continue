from typing import Coroutine, Union
from ..models.filesystem_edit import FileSystemEdit
from ..models.filesystem import RangeInFile
from ..libs.llm import LLM
from .observation import Observation
from ..server.ide_protocol import AbstractIdeProtocolServer
from .main import History, Step
from ..libs.steps.core.core import *


class Agent:
    pass


class ContinueSDKSteps:
    def __init__(self, sdk: "ContinueSDK"):
        self.sdk = sdk


class ContinueSDK:
    """The SDK provided as parameters to a step"""
    llm: LLM
    ide: AbstractIdeProtocolServer
    steps: ContinueSDKSteps
    __agent: Agent

    def __init__(self, agent: Agent, llm: Union[LLM, None] = None):
        if llm is None:
            self.llm = agent.llm
        else:
            self.llm = llm
        self.ide = agent.ide
        self.__agent = agent
        self.steps = ContinueSDKSteps(self)

    @property
    def history(self) -> History:
        return self.__agent.history

    async def run_step(self, step: Step) -> Coroutine[Observation, None, None]:
        return await self.__agent._run_singular_step(step)

    async def apply_filesystem_edit(self, edit: FileSystemEdit):
        await self.run_step(FileSystemEditStep(edit=edit))

    async def wait_for_user_input(self) -> str:
        return await self.__agent.wait_for_user_input()

    async def wait_for_user_confirmation(self, prompt: str):
        return await self.run_step(WaitForUserConfirmationStep(prompt=prompt))

    async def run(self, commands: List[str] | str, cwd: str = None):
        commands = commands if isinstance(commands, List) else [commands]
        return self.run_step(ShellCommandsStep(commands=commands, cwd=cwd))

    async def edit_file(self, filename: str, prompt: str):
        await self.ide.setFileOpen(filename)
        contents = await self.ide.readFile(filename)
        await self.run_step(EditCodeStep(
            range_in_files=[RangeInFile.from_entire_file(filename, contents)],
            prompt=f'Here is the code before:\n\n{{code}}\n\nHere is the user request:\n\n{prompt}\n\nHere is the code edited to perfectly solve the user request:\n\n'
        ))
