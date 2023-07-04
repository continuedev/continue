from textwrap import dedent
from typing import List, Tuple, Type

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


class DemoPolicy(Policy):
    ran_code_last: bool = False

    def next(self, config: ContinueConfig, history: History) -> Step:
        # At the very start, run initial Steps spcecified in the config
        if history.get_current() is None:
            return (
                MessageStep(name="Welcome to Continue", message=dedent("""\
                    - Highlight code and ask a question or give instructions
                    - Past steps are used as additional context by default
                    - Use slash commands when you want fine-grained control
                    - Use cmd+k (MacOS) or ctrl+k (Windows) to toggle Continue""")) >>
                WelcomeStep() >>
                # SetupContinueWorkspaceStep() >>
                # CreateCodebaseIndexChroma() >>
                StepsOnStartupStep())

        observation = history.get_current().observation
        if observation is not None and isinstance(observation, UserInputObservation):
            # This could be defined with ObservationTypePolicy. Ergonomics not right though.
            user_input = observation.user_input

            if user_input.startswith("/"):
                command_name = user_input.split(" ")[0]
                after_command = " ".join(user_input.split(" ")[1:])
                for slash_command in config.slash_commands:
                    if slash_command.name == command_name[1:]:
                        params = slash_command.params
                        params["user_input"] = after_command
                        return get_step_from_name(slash_command.step_name, params)

                for custom_cmd in config.custom_commands:
                    if custom_cmd.name == command_name[1:]:
                        return CustomCommandStep(name=custom_cmd.name, prompt=custom_cmd.prompt, user_input=after_command)

            # return EditHighlightedCodeStep(user_input=user_input)
            return ChatWithFunctions(user_input=user_input)
            return NLDecisionStep(user_input=user_input, steps=[
                (EditHighlightedCodeStep(user_input=user_input),
                 "Edit the highlighted code"),
                # AnswerQuestionChroma(question=user_input),
                # EditFileChroma(request=user_input),
                (SimpleChatStep(user_input=user_input),
                 "Respond to the user with a chat message. Can answer questions about code or anything else."),
            ], default_step=EditHighlightedCodeStep(user_input=user_input))

        state = history.get_current()

        if observation is not None and isinstance(observation, TracebackObservation):
            self.ran_code_last = False
            return SolveTracebackStep(traceback=observation.traceback)
        else:
            return None
