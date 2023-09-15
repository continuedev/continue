default_config = """\
\"\"\"
This is the Continue configuration file.

See https://continue.dev/docs/customization to for documentation of the available options.
\"\"\"

from continuedev.src.continuedev.core.models import Models
from continuedev.src.continuedev.core.config import CustomCommand, SlashCommand, ContinueConfig
from continuedev.src.continuedev.plugins.context_providers.github import GitHubIssuesContextProvider
from continuedev.src.continuedev.libs.llm.maybe_proxy_openai import MaybeProxyOpenAI

from continuedev.src.continuedev.plugins.steps.open_config import OpenConfigStep
from continuedev.src.continuedev.plugins.steps.clear_history import ClearHistoryStep
from continuedev.src.continuedev.plugins.steps.feedback import FeedbackStep
from continuedev.src.continuedev.plugins.steps.comment_code import CommentCodeStep
from continuedev.src.continuedev.plugins.steps.share_session import ShareSessionStep
from continuedev.src.continuedev.plugins.steps.main import EditHighlightedCodeStep
from continuedev.src.continuedev.plugins.steps.cmd import GenerateShellCommandStep
from continuedev.src.continuedev.plugins.context_providers.search import SearchContextProvider
from continuedev.src.continuedev.plugins.context_providers.diff import DiffContextProvider
from continuedev.src.continuedev.plugins.context_providers.url import URLContextProvider
from continuedev.src.continuedev.plugins.context_providers.terminal import TerminalContextProvider

config = ContinueConfig(
    allow_anonymous_telemetry=True,
    models=Models(
        default=MaybeProxyOpenAI(api_key="", model="gpt-4"),
        medium=MaybeProxyOpenAI(api_key="", model="gpt-3.5-turbo")
    ),
    system_message=None,
    temperature=0.5,
    custom_commands=[
        CustomCommand(
            name="test",
            description="Write unit tests for the highlighted code",
            prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
        )
    ],
    slash_commands=[
        SlashCommand(
            name="edit",
            description="Edit code in the current file or the highlighted code",
            step=EditHighlightedCodeStep,
        ),
        SlashCommand(
            name="config",
            description="Customize Continue - slash commands, LLMs, system message, etc.",
            step=OpenConfigStep,
        ),
        SlashCommand(
            name="comment",
            description="Write comments for the current file or highlighted code",
            step=CommentCodeStep,
        ),
        SlashCommand(
            name="feedback",
            description="Send feedback to improve Continue",
            step=FeedbackStep,
        ),
        SlashCommand(
            name="clear",
            description="Clear step history",
            step=ClearHistoryStep,
        ),
        SlashCommand(
            name="share",
            description="Download and share the session transcript",
            step=ShareSessionStep,
        ),
        SlashCommand(
            name="cmd",
            description="Generate a shell command",
            step=GenerateShellCommandStep,
        ),
    ],
    context_providers=[
        # GitHubIssuesContextProvider(
        #     repo_name="<your github username or organization>/<your repo name>",
        #     auth_token="<your github auth token>"
        # ),
        SearchContextProvider(),
        DiffContextProvider(),
        URLContextProvider(
            preset_urls = [
                # Add any common urls you reference here so they appear in autocomplete
            ]
        ),
        TerminalContextProvider(),
    ],
)
"""
