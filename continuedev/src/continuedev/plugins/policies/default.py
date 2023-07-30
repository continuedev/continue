from textwrap import dedent
from typing import Union

from ..steps.chat import SimpleChatStep
from ..steps.welcome import WelcomeStep
from ...core.config import ContinueConfig
from ..steps.steps_on_startup import StepsOnStartupStep
from ...core.main import Step, History, Policy
from ...core.observation import UserInputObservation
from ..steps.core.core import MessageStep
from ..steps.custom_command import CustomCommandStep
from ..steps.main import EditHighlightedCodeStep


def parse_slash_command(inp: str, config: ContinueConfig) -> Union[None, Step]:
    """
    Parses a slash command, returning the command name and the rest of the input.
    """
    if inp.startswith("/"):
        command_name = inp.split(" ")[0]
        after_command = " ".join(inp.split(" ")[1:])

        for slash_command in config.slash_commands:
            if slash_command.name == command_name[1:]:
                params = slash_command.params
                params["user_input"] = after_command
                try:
                    return slash_command.step(**params)
                except TypeError as e:
                    raise Exception(
                        f"Incorrect params used for slash command '{command_name}': {e}")
    return None


def parse_custom_command(inp: str, config: ContinueConfig) -> Union[None, Step]:
    command_name = inp.split(" ")[0]
    after_command = " ".join(inp.split(" ")[1:])
    for custom_cmd in config.custom_commands:
        if custom_cmd.name == command_name[1:]:
            slash_command = parse_slash_command(custom_cmd.prompt, config)
            if slash_command is not None:
                return slash_command
            return CustomCommandStep(name=custom_cmd.name, description=custom_cmd.description, prompt=custom_cmd.prompt, user_input=after_command, slash_command=command_name)
    return None


class DefaultPolicy(Policy):
    ran_code_last: bool = False

    def next(self, config: ContinueConfig, history: History) -> Step:
        # At the very start, run initial Steps spcecified in the config
        if history.get_current() is None:
            return (
                MessageStep(name="Welcome to Continue", message=dedent("""\
                    - Highlight code section and ask a question or give instructions
                    - Use `cmd+m` (Mac) / `ctrl+m` (Windows) to open Continue
                    - Use `/help` to ask questions about how to use Continue""")) >>
                WelcomeStep() >>
                StepsOnStartupStep())

        observation = history.get_current().observation
        if observation is not None and isinstance(observation, UserInputObservation):
            # This could be defined with ObservationTypePolicy. Ergonomics not right though.
            user_input = observation.user_input

            slash_command = parse_slash_command(user_input, config)
            if slash_command is not None:
                return slash_command

            custom_command = parse_custom_command(user_input, config)
            if custom_command is not None:
                return custom_command

            if user_input.startswith("/edit"):
                return EditHighlightedCodeStep(user_input=user_input[5:])

            return SimpleChatStep()

        return None
