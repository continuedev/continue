from typing import List, Tuple, Type

from .config import ContinueConfig
from ..steps.chroma import AnswerQuestionChroma, EditFileChroma, CreateCodebaseIndexChroma
from ..steps.steps_on_startup import StepsOnStartupStep
from ..recipes.CreatePipelineRecipe.main import CreatePipelineRecipe
from ..recipes.DeployPipelineAirflowRecipe.main import DeployPipelineAirflowRecipe
from ..recipes.AddTransformRecipe.main import AddTransformRecipe
from .main import Step, Validator, History, Policy
from .observation import Observation, TracebackObservation, UserInputObservation
from ..steps.main import EditHighlightedCodeStep, SolveTracebackStep, RunCodeStep, FasterEditHighlightedCodeStep, StarCoderEditHighlightedCodeStep, EmptyStep, SetupContinueWorkspaceStep
from ..recipes.WritePytestsRecipe.main import WritePytestsRecipe
from ..recipes.ContinueRecipeRecipe.main import ContinueStepStep
from ..steps.comment_code import CommentCodeStep
from ..steps.react import NLDecisionStep
from ..steps.chat import SimpleChatStep
from ..recipes.DDtoBQRecipe.main import DDtoBQRecipe
from ..steps.core.core import MessageStep
from ..libs.util.step_name_to_steps import get_step_from_name


class DemoPolicy(Policy):
    ran_code_last: bool = False

    def next(self, config: ContinueConfig, history: History) -> Step:
        # At the very start, run initial Steps spcecified in the config
        if history.get_current() is None:
            return (
                MessageStep(name="Welcome to Continue!", message="You can type a question or instructions for a file edit in the text box. If you highlight code, edits will be localized to the highlighted range. Otherwise, the currently open file is taken as context. If you type '/', you can see the list of available slash commands.") >>
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

            if "/ask" in user_input:
                return AnswerQuestionChroma(question=" ".join(user_input.split(" ")[1:]))
            elif "/edit" in user_input:
                return EditFileChroma(request=" ".join(user_input.split(" ")[1:]))
            elif "/step" in user_input:
                return ContinueStepStep(prompt=" ".join(user_input.split(" ")[1:]))
            # return EditHighlightedCodeStep(user_input=user_input)
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
