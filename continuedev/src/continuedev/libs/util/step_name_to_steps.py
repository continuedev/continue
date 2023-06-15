from typing import Dict

from ...core.main import Step
from ...steps.core.core import UserInputStep
from ...steps.main import EditHighlightedCodeStep
from ...steps.chat import SimpleChatStep
from ...steps.comment_code import CommentCodeStep
from ...steps.feedback import FeedbackStep

step_name_to_step_class = {
    "UserInputStep": UserInputStep,
    "EditHighlightedCodeStep": EditHighlightedCodeStep,
    "SimpleChatStep": SimpleChatStep,
    "CommentCodeStep": CommentCodeStep,
    "FeedbackStep": FeedbackStep,
}


def get_step_from_name(step_name: str, params: Dict) -> Step:
    try:
        return step_name_to_step_class[step_name](**params)
    except:
        print(
            f"Incorrect parameters for step {step_name}. Parameters provided were: {params}")
        raise