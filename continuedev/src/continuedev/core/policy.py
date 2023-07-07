from textwrap import dedent
from typing import List, Tuple, Type, Union

from ..steps.welcome import WelcomeStep
from .config import ContinueConfig
from ..steps.chroma import AnswerQuestionChroma, EditFileChroma, CreateCodebaseIndexChroma
from ..steps.steps_on_startup import StepsOnStartupStep
from ..recipes.CreatePipelineRecipe.main import CreatePipelineRecipe
from ..recipes.DeployPipelineAirflowRecipe.main import DeployPipelineAirflowRecipe
from ..recipes.AddTransformRecipe.main import AddTransformRecipe
from .main import Step, Validator, History, Policy
from .observation import Observation, TracebackObservation, UserInputObservation
from ..steps.main import EditHighlightedCodeStep, SolveTracebackStep
from ..recipes.WritePytestsRecipe.main import WritePytestsRecipe
from ..recipes.ContinueRecipeRecipe.main import ContinueStepStep
from ..steps.comment_code import CommentCodeStep
from ..steps.react import NLDecisionStep
from ..steps.chat import SimpleChatStep, ChatWithFunctions, EditFileStep, AddFileStep
from ..recipes.DDtoBQRecipe.main import DDtoBQRecipe
from ..steps.core.core import MessageStep
from ..libs.util.step_name_to_steps import get_step_from_name
from ..steps.custom_command import CustomCommandStep


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
                return get_step_from_name(slash_command.step_name, params)
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


class DemoPolicy(Policy):
    ran_code_last: bool = False

    def next(self, config: ContinueConfig, history: History) -> Step:
        # At the very start, run initial Steps spcecified in the config
        if history.get_current() is None:
            return (
                MessageStep(name="Welcome to Continue", message=dedent("""\
                    - Highlight code and ask a question or give instructions
                    - Use `cmd+k` (Mac) / `ctrl+k` (Windows) to open Continue
                    - Use `cmd+shift+e` / `ctrl+shift+e` to open file Explorer
                    - Add your own OpenAI API key to VS Code Settings with `cmd+,`
                    - Use slash commands when you want fine-grained control
                    - Past steps are included as part of the context by default""")) >>
                WelcomeStep() >>
                # SetupContinueWorkspaceStep() >>
                # CreateCodebaseIndexChroma() >>
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

            return SimpleChatStep()

        return None
