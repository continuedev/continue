from typing import Dict

from ...core.main import Step
from ...steps.core.core import UserInputStep
from ...steps.main import EditHighlightedCodeStep
from ...steps.chat import SimpleChatStep
from ...steps.comment_code import CommentCodeStep
from ...steps.feedback import FeedbackStep
from ...recipes.AddTransformRecipe.main import AddTransformRecipe
from ...recipes.CreatePipelineRecipe.main import CreatePipelineRecipe
from ...recipes.DDtoBQRecipe.main import DDtoBQRecipe
from ...recipes.DeployPipelineAirflowRecipe.main import DeployPipelineAirflowRecipe
from ...steps.on_traceback import DefaultOnTracebackStep
from ...steps.clear_history import ClearHistoryStep

# This mapping is used to convert from string in ContinueConfig json to corresponding Step class.
# Used for example in slash_commands and steps_on_startup
step_name_to_step_class = {
    "UserInputStep": UserInputStep,
    "EditHighlightedCodeStep": EditHighlightedCodeStep,
    "SimpleChatStep": SimpleChatStep,
    "CommentCodeStep": CommentCodeStep,
    "FeedbackStep": FeedbackStep,
    "AddTransformRecipe": AddTransformRecipe,
    "CreatePipelineRecipe": CreatePipelineRecipe,
    "DDtoBQRecipe": DDtoBQRecipe,
    "DeployPipelineAirflowRecipe": DeployPipelineAirflowRecipe,
    "DefaultOnTracebackStep": DefaultOnTracebackStep,
    "ClearHistoryStep": ClearHistoryStep,
}


def get_step_from_name(step_name: str, params: Dict) -> Step:
    try:
        return step_name_to_step_class[step_name](**params)
    except:
        print(
            f"Incorrect parameters for step {step_name}. Parameters provided were: {params}")
        raise
