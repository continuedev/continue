from typing import Dict

from ...core.main import Step
from ...libs.util.logging import logger
from ...plugins.recipes.AddTransformRecipe.main import AddTransformRecipe
from ...plugins.recipes.CreatePipelineRecipe.main import CreatePipelineRecipe
from ...plugins.recipes.DDtoBQRecipe.main import DDtoBQRecipe
from ...plugins.recipes.DeployPipelineAirflowRecipe.main import (
    DeployPipelineAirflowRecipe,
)
from ...plugins.steps.chat import SimpleChatStep
from ...plugins.steps.clear_history import ClearHistoryStep
from ...plugins.steps.comment_code import CommentCodeStep
from ...plugins.steps.core.core import UserInputStep
from ...plugins.steps.feedback import FeedbackStep
from ...plugins.steps.help import HelpStep
from ...plugins.steps.main import EditHighlightedCodeStep
from ...plugins.steps.on_traceback import DefaultOnTracebackStep
from ...plugins.steps.open_config import OpenConfigStep

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
    "OpenConfigStep": OpenConfigStep,
    "HelpStep": HelpStep,
}


def get_step_from_name(step_name: str, params: Dict) -> Step:
    try:
        return step_name_to_step_class[step_name](**params)
    except:
        logger.error(
            f"Incorrect parameters for step {step_name}. Parameters provided were: {params}"
        )
        raise
