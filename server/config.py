"""
This is the Continue configuration file.

See https://continue.dev/docs/customization to for documentation of the available options.
"""

from continuedev.core.models import Models
from continuedev.core.config import CustomCommand, SlashCommand, ContinueConfig
from continuedev.libs.llm import OpenAIFreeTrial

from continuedev.plugins.context_providers import (
    DiffContextProvider,
    TerminalContextProvider,
    URLContextProvider,
    GitHubIssuesContextProvider,
)
from continuedev.plugins.steps import (
    ClearHistoryStep,
    CommentCodeStep,
    EditHighlightedCodeStep,
    GenerateShellCommandStep,
    OpenConfigStep,
)
from continuedev.plugins.steps.share_session import ShareSessionStep

config = ContinueConfig(
    allow_anonymous_telemetry=True,
    models=Models(
        default=OpenAIFreeTrial(api_key="", model="gpt-4", title="GPT-4"),
        summarize=OpenAIFreeTrial(api_key="", model="gpt-3.5-turbo"),
    ),
    system_message=None,
    temperature=0.5,
    custom_commands=[
        CustomCommand(
            name="test",
            description="Write unit tests for highlighted code",
            prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
        )
    ],
    slash_commands=[
        SlashCommand(
            name="edit",
            description="Edit highlighted code",
            step=EditHighlightedCodeStep,
        ),
        SlashCommand(
            name="config",
            description="Customize Continue",
            step=OpenConfigStep,
        ),
        SlashCommand(
            name="comment",
            description="Write comments for the highlighted code",
            step=CommentCodeStep,
        ),
        SlashCommand(
            name="clear",
            description="Clear step history",
            step=ClearHistoryStep,
        ),
        SlashCommand(
            name="share",
            description="Download and share this session",
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
        DiffContextProvider(),
        URLContextProvider(
            preset_urls=[
                # Add any common urls you reference here so they appear in autocomplete
            ]
        ),
        TerminalContextProvider(),
    ],
)
