from typing import List, Tuple, Type

from ..steps.chroma import AnswerQuestionChroma, EditFileChroma, CreateCodebaseIndexChroma
from ..steps.steps_on_startup import StepsOnStartupStep
from ..recipes.CreatePipelineRecipe.main import CreatePipelineRecipe
from ..recipes.DeployPipelineAirflowRecipe.main import DeployPipelineAirflowRecipe
from .main import Step, Validator, History, Policy
from .observation import Observation, TracebackObservation, UserInputObservation
from ..steps.main import EditHighlightedCodeStep, SolveTracebackStep, RunCodeStep, FasterEditHighlightedCodeStep, StarCoderEditHighlightedCodeStep, MessageStep, EmptyStep, SetupContinueWorkspaceStep
from ..recipes.WritePytestsRecipe.main import WritePytestsRecipe
from ..recipes.ContinueRecipeRecipe.main import ContinueStepStep
from ..steps.comment_code import CommentCodeStep


class DemoPolicy(Policy):
    ran_code_last: bool = False

    def next(self, history: History) -> Step:
        # At the very start, run initial Steps spcecified in the config
        if history.get_current() is None:
            return (
                # MessageStep(name="Welcome to Continue!", message="") >>
                # SetupContinueWorkspaceStep() >>
                # CreateCodebaseIndexChroma() >>
                StepsOnStartupStep())

        observation = history.get_current().observation
        if observation is not None and isinstance(observation, UserInputObservation):
            # This could be defined with ObservationTypePolicy. Ergonomics not right though.
            if "/pytest" in observation.user_input.lower():
                return WritePytestsRecipe(instructions=observation.user_input)
            elif "/dlt" in observation.user_input.lower():
                return CreatePipelineRecipe()
            elif "/airflow" in observation.user_input.lower():
                return DeployPipelineAirflowRecipe()
            elif "/comment" in observation.user_input.lower():
                return CommentCodeStep()
            elif "/ask" in observation.user_input:
                return AnswerQuestionChroma(question=" ".join(observation.user_input.split(" ")[1:]))
            elif "/edit" in observation.user_input:
                return EditFileChroma(request=" ".join(observation.user_input.split(" ")[1:]))
            elif "/step" in observation.user_input:
                return ContinueStepStep(prompt=" ".join(observation.user_input.split(" ")[1:]))
            return EditHighlightedCodeStep(user_input=observation.user_input)

        state = history.get_current()

        if observation is not None and isinstance(observation, TracebackObservation):
            self.ran_code_last = False
            return SolveTracebackStep(traceback=observation.traceback)
        else:
            return None


class ObservationTypePolicy(Policy):
    def __init__(self, base_policy: Policy, observation_type: Type[Observation], step_type: Type[Step]):
        self.observation_type = observation_type
        self.step_type = step_type
        self.base_policy = base_policy

    def next(self, history: History) -> Step:
        observation = history.last_observation()
        if observation is not None and isinstance(observation, self.observation_type):
            return self.step_type(observation)
        return self.base_policy.next(history)


class PolicyWrappedWithValidators(Policy):
    """Default is to stop, unless the validator tells what to do next"""
    index: int
    stage: int

    def __init__(self, base_policy: Policy, pairs: List[Tuple[Validator, Type[Step]]]):
        # Want to pass Type[Validator], or just the Validator? Question of where params are coming from.
        self.pairs = pairs
        self.index = len(pairs)
        self.validating = 0
        self.base_policy = base_policy

    def next(self, history: History) -> Step:
        if self.index == len(self.pairs):
            self.index = 0
            return self.base_policy.next(history)

        if self.stage == 0:
            # Running the validator at the current index for the first time
            validator, step = self.pairs[self.index]
            self.stage = 1
            return validator
        elif self.stage == 1:
            # Previously ran the validator at the current index, now receiving its ValidatorObservation
            observation = history.last_observation()
            if observation.passed:
                self.stage = 0
                self.index += 1
                if self.index == len(self.pairs):
                    self.index = 0
                    return self.base_policy.next(history)
                else:
                    return self.pairs[self.index][0]
            else:
                _, step_type = self.pairs[self.index]
                return step_type(observation)
