from typing import Coroutine, Union
from ..models.filesystem_edit import FileSystemEdit
from .llm import LLM
from .observation import Observation
from ..server.ide_protocol import AbstractIdeProtocolServer
from .core import History, Step
from .steps.core.core import *


class Agent:
    pass


class ContinueSDK:
    """The SDK provided as parameters to a step"""
    llm: LLM
    ide: AbstractIdeProtocolServer
    __agent: Agent

    def __init__(self, agent: Agent, llm: Union[LLM, None] = None):
        if llm is None:
            self.llm = agent.llm
        else:
            self.llm = llm
        self.ide = agent.ide
        self.__agent = agent

    @property
    def history(self) -> History:
        return self.__agent.history

    async def run_step(self, step: Step) -> Coroutine[Observation, None, None]:
        return await self.__agent._run_singular_step(step)

    async def apply_filesystem_edit(self, edit: FileSystemEdit):
        await self.run_step(FileSystemEditStep(edit=edit))

    async def wait_for_user_input(self) -> str:
        return await self.__agent.wait_for_user_input()
