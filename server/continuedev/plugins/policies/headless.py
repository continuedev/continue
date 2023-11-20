from typing import Optional, cast

from ...core.config import ContinueConfig
from ...core.main import Policy, SessionState, Step
from ...core.observation import TextObservation
from ...core.steps import ShellCommandsStep
from ...plugins.steps.on_traceback import DefaultOnTracebackStep


class HeadlessPolicy(Policy):
    command: str

    def next(
        self, config: ContinueConfig, session_state: SessionState
    ) -> Optional[Step]:
        if len(session_state.history) == 0:
            return ShellCommandsStep(cmds=[self.command])

        observations = session_state.history[-1].observations
        if traceback_obs := next(
            filter(lambda obs: isinstance(obs, TextObservation), observations), None
        ):
            return DefaultOnTracebackStep(
                output=cast(TextObservation, traceback_obs).text
            )

        return None
