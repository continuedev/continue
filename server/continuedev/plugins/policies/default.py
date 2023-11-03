from typing import Type, Union

from ..steps.clear_history import ClearHistoryStep
from ..steps.comment_code import CommentCodeStep
from ..steps.share_session import ShareSessionStep
from ..steps.codebase import AnswerQuestionChroma
from ...core.config import ContinueConfig
from ...core.main import Policy, SessionState, Step
from ..steps.chat import SimpleChatStep
from ..steps.custom_command import CustomCommandStep
from ..steps.main import EditHighlightedCodeStep
from ..steps.steps_on_startup import StepsOnStartupStep
from ..steps.cmd import GenerateShellCommandStep


# When importing with importlib from config.py, the classes do not pass isinstance checks.
# Mapping them here is a workaround.
# Original description of the problem: https://github.com/continuedev/continue/pull/581#issuecomment-1778138841
REPLACEMENT_SLASH_COMMAND_STEPS = [
    AnswerQuestionChroma,
    GenerateShellCommandStep,
    EditHighlightedCodeStep,
    ShareSessionStep,
    CommentCodeStep,
    ClearHistoryStep,
]


def parse_slash_command(inp: str, config: ContinueConfig) -> Union[None, Step]:
    """
    Parses a slash command, returning the command name and the rest of the input.
    """
    if inp.startswith("/"):
        command_name = inp.split(" ")[0].strip()
        after_command = " ".join(inp.split(" ")[1:])

        for slash_command in config.slash_commands:
            if slash_command.name == command_name[1:]:
                params = slash_command.params
                params["user_input"] = after_command
                try:
                    for replacement_step in REPLACEMENT_SLASH_COMMAND_STEPS:
                        if slash_command.step.__name__ == replacement_step.__name__:
                            return replacement_step(**params)

                    return slash_command.step(**params)
                except TypeError as e:
                    raise Exception(
                        f"Incorrect params used for slash command '{command_name}': {e}"
                    )
    return None


def parse_custom_command(inp: str, config: ContinueConfig) -> Union[None, Step]:
    command_name = inp.split(" ")[0].strip()
    after_command = " ".join(inp.split(" ")[1:])
    for custom_cmd in config.custom_commands:
        if custom_cmd.name == command_name[1:]:
            slash_command = parse_slash_command(custom_cmd.prompt, config)
            if slash_command is not None:
                return slash_command
            return CustomCommandStep(
                name=custom_cmd.name,
                description=custom_cmd.description,
                prompt=custom_cmd.prompt,
                user_input=after_command,
                slash_command=command_name,
            )
    return None


class DefaultPolicy(Policy):
    default_step: Type[Step] = SimpleChatStep
    default_params: dict = {}

    def next(self, config: ContinueConfig, session_state: SessionState) -> Step:
        # At the very start, run initial Steps specified in the config
        if len(session_state.history) == 0:
            return StepsOnStartupStep()

        last_step = session_state.history[-1]
        if last_step.step_type == "UserInputStep":
            user_input = last_step.description

            slash_command = parse_slash_command(user_input, config)
            if slash_command is not None:
                if (
                    getattr(slash_command, "user_input", None) is None
                    and last_step.params["user_input"] is not None
                ):
                    last_step.params["user_input"] = last_step.params[
                        "user_input"
                    ].split()[0]
                return slash_command

            custom_command = parse_custom_command(user_input, config)
            if custom_command is not None:
                return custom_command

            if user_input.startswith("/edit"):
                return EditHighlightedCodeStep(user_input=user_input[5:])

            if user_input.startswith("/codebase "):
                return AnswerQuestionChroma(user_input=user_input[len("/codebase ") :])

            return self.default_step(**self.default_params)
