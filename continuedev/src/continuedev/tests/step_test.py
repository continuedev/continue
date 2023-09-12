import pytest

from continuedev.core.config import ContinueConfig
from continuedev.headless import start_headless_session
from continuedev.models.filesystem import Range, RangeInFileWithContents
from continuedev.plugins.steps.chat import SimpleChatStep
from continuedev.plugins.steps.core.core import UserInputStep
from continuedev.plugins.steps.main import EditHighlightedCodeStep
from continuedev.plugins.steps.on_traceback import DefaultOnTracebackStep
from continuedev.tests.util.prompts import dotenv_test_pair, tokyo_test_pair

TEST_CONFIG = ContinueConfig()


@pytest.mark.asyncio
async def test_step():
    pytest.skip("TODO: too slow")
    session = await start_headless_session(config=TEST_CONFIG)

    await session.autopilot.run_from_step(UserInputStep(user_input=tokyo_test_pair[0]))

    full_state = await session.autopilot.get_full_state()

    assert isinstance(full_state.history.timeline[-1].step, SimpleChatStep)

    assert not full_state.history.timeline[-1].step.hide

    assert (
        full_state.history.timeline[-1].step.description.strip().lower()
        == tokyo_test_pair[1]
    )

    await session.autopilot.cleanup()


@pytest.mark.asyncio
async def test_traceback_step():
    pytest.skip("TODO: too slow")
    session = await start_headless_session(config=TEST_CONFIG)

    await session.autopilot.run_from_step(
        DefaultOnTracebackStep(output=dotenv_test_pair[0])
    )

    full_state = await session.autopilot.get_full_state()
    assert dotenv_test_pair[1] in full_state.history.timeline[-1].step.description

    await session.autopilot.cleanup()


@pytest.mark.asyncio
async def test_edit_step():
    pytest.skip("TODO: too slow")
    session = await start_headless_session(config=TEST_CONFIG)

    range_in_file = RangeInFileWithContents(
        filepath=__file__, range=Range.from_shorthand(0, 0, 0, 0), contents=""
    )

    await session.autopilot.handle_highlighted_code(range_in_files=[range_in_file])

    await session.autopilot.run_from_step(
        EditHighlightedCodeStep(user_input="Don't edit this code")
    )

    full_state = await session.autopilot.get_full_state()
    assert isinstance(full_state.history.timeline[-1].step.description, str)

    await session.autopilot.cleanup()
