from ...core.config import ContinueConfig
from ...core.main import History, Policy, Step
from ...core.observation import TextObservation
from ...plugins.steps.core.core import ShellCommandsStep
from ...plugins.steps.on_traceback import DefaultOnTracebackStep


class HeadlessPolicy(Policy):
    command: str

    def next(self, config: ContinueConfig, history: History) -> Step:
        if history.get_current() is None:
            return ShellCommandsStep(cmds=[self.command])
        observation = history.get_current().observation
        if isinstance(observation, TextObservation):
            return DefaultOnTracebackStep(output=observation.text)

        return None
