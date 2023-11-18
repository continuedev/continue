from typing import Optional, Type, Union

from ...core.config import ContinueConfig
from ...core.config_utils.step_name_to_class import step_name_to_step_class
from ...core.main import Policy, SessionState, Step
from ...models.main import Position, PositionInFile
from ..steps.chat import SimpleChatStep
from ..steps.codebase import AnswerQuestionChroma
from ..steps.custom_command import CustomCommandStep
from ..steps.main import EditHighlightedCodeStep
from ..steps.refactor import RefactorReferencesStep
from ..steps.stack_overflow import StackOverflowStep
from ..steps.steps_on_startup import StepsOnStartupStep

# When importing with importlib from config.py, the classes do not pass isinstance checks.
# Mapping them here is a workaround.
# Original description of the problem: https://github.com/continuedev/continue/pull/581#issuecomment-1778138841


def parse_slash_command(inp: str, config: ContinueConfig) -> Union[None, Step]:
    """
    Parses a slash command, returning the command name and the rest of the input.
    """
    if inp.startswith("/"):
        command_name = inp.split(" ")[0].strip()
        after_command = " ".join(inp.split(" ")[1:])

        for slash_command in config.slash_commands or []:
            if slash_command.name == command_name[1:]:
                params = slash_command.params or {}
                params["user_input"] = after_command
                try:
                    if isinstance(slash_command.step, str):
                        if slash_command.step not in step_name_to_step_class:
                            return None

                        return step_name_to_step_class[slash_command.step](**params)
                    elif isinstance(slash_command.step, object):
                        if (
                            slash_command.step.__class__.__name__
                            not in step_name_to_step_class
                        ):
                            return slash_command.step(**params)

                        return step_name_to_step_class[
                            slash_command.step.__class__.__name__
                        ](**params)

                except TypeError as e:
                    raise Exception(
                        f"Incorrect params used for slash command '{command_name}': {e}"
                    )
    return None


def parse_custom_command(inp: str, config: ContinueConfig) -> Union[None, Step]:
    command_name = inp.split(" ")[0].strip()
    after_command = " ".join(inp.split(" ")[1:])
    for custom_cmd in config.custom_commands or []:
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

    def next(
        self, config: ContinueConfig, session_state: SessionState
    ) -> Optional[Step]:
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

            if user_input.startswith("/so "):
                return StackOverflowStep(user_input=user_input[len("/so ") :])

            if user_input.startswith("/references "):
                args = user_input.split()
                return RefactorReferencesStep(
                    user_input="Update this reference to reflect the new definition",
                    symbol_location=PositionInFile(
                        filepath=args[1],
                        position=Position(line=int(args[2]), character=int(args[3])),
                    ),
                )

            return self.default_step(**self.default_params)
