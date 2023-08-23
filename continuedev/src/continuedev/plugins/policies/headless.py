from ...core.config import ContinueConfig
from ...core.main import History, Policy, Step


class HeadlessPolicy(Policy):
    command: str

    def next(self, config: ContinueConfig, history: History) -> Step:
        print("Hello world")
        # if history.get_current() is None:
        #     return RunCommandStep(command=self.command)

        # observation = history.get_current().observation
        # if isinstance(observation, UserInputObservation):
        #     pass

        return None
