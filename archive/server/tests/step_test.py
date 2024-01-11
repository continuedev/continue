import pytest
from continuedev.core.config import ContinueConfig
from continuedev.core.steps import UserInputStep
from continuedev.headless import get_headless_autopilot
from continuedev.models.filesystem import Range, RangeInFileWithContents
from continuedev.plugins.context_providers.highlighted_code import (
    HighlightedCodeContextProvider,
)
from continuedev.plugins.steps.main import EditHighlightedCodeStep
from continuedev.plugins.steps.on_traceback import DefaultOnTracebackStep

from .util.prompts import dotenv_test_pair, tokyo_test_pair

TEST_CONFIG = ContinueConfig()


@pytest.mark.asyncio
async def test_step():
    pytest.skip("TODO: too slow")
    autopilot = await get_headless_autopilot(config=TEST_CONFIG)

    await autopilot.run(UserInputStep(user_input=tokyo_test_pair[0]))

    state = autopilot.session_state

    assert state.history[-1].step_type == "SimpleChatStep"
    assert not state.history[-1].hide
    assert state.history[-1].description.strip().lower() == tokyo_test_pair[1]


@pytest.mark.asyncio
async def test_traceback_step():
    pytest.skip("TODO: too slow")
    autopilot = await get_headless_autopilot(config=TEST_CONFIG)

    await autopilot.run(DefaultOnTracebackStep(output=dotenv_test_pair[0]))

    state = autopilot.session_state
    assert dotenv_test_pair[1] in state.history[-1].description


@pytest.mark.asyncio
async def test_edit_step():
    pytest.skip("TODO: too slow")
    autopilot = await get_headless_autopilot(config=TEST_CONFIG)
    sdk = autopilot.sdk
    range_in_file = RangeInFileWithContents(
        filepath=__file__, range=Range.from_shorthand(0, 0, 0, 0), contents=""
    )
    await sdk.add_context_item(
        HighlightedCodeContextProvider.rif_to_context_item(range_in_file, 0, True)
    )

    await autopilot.run(EditHighlightedCodeStep(user_input="Don't edit this code"))

    state = autopilot.session_state
    assert (
        isinstance(state.history[-1].description, str)
        and len(state.history[-1].description) > 0
    )
