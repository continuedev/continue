from ...plugins.steps.clear_history import ClearHistoryStep
from ...plugins.steps.cmd import GenerateShellCommandStep
from ...plugins.steps.codebase import AnswerQuestionChroma
from ...plugins.steps.comment_code import CommentCodeStep
from ...plugins.steps.main import EditHighlightedCodeStep
from ...plugins.steps.on_traceback import DefaultOnTracebackStep
from ...plugins.steps.open_config import OpenConfigStep
from ...plugins.steps.share_session import ShareSessionStep
from ...plugins.steps.stack_overflow import StackOverflowStep

step_name_to_step_class = {
    "EditHighlightedCodeStep": EditHighlightedCodeStep,
    "CommentCodeStep": CommentCodeStep,
    "DefaultOnTracebackStep": DefaultOnTracebackStep,
    "ClearHistoryStep": ClearHistoryStep,
    "OpenConfigStep": OpenConfigStep,
    "AnswerQuestionChroma": AnswerQuestionChroma,
    "GenerateShellCommandStep": GenerateShellCommandStep,
    "ShareSessionStep": ShareSessionStep,
    "StackOverflowStep": StackOverflowStep,
}
