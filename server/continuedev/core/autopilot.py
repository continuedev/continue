import inspect
import uuid
from typing import List, Optional, cast

from aiohttp import ClientPayloadError
from openai import error as openai_errors

from ..libs.llm.prompts.chat import template_alpaca_messages
from ..libs.util.devdata import dev_data_logger
from ..libs.util.errors import format_exc
from ..libs.util.logging import logger
from ..libs.util.strings import remove_quotes_and_escapes
from ..libs.util.telemetry import posthog_logger
from ..plugins.policies.default import DefaultPolicy
from ..server.protocols.gui_protocol import AbstractGUIProtocolServer
from ..server.protocols.ide_protocol import AbstractIdeProtocolServer
from .config import ContinueConfig
from .context import ContextManager
from .main import (
    AutopilotGenerator,
    AutopilotGeneratorOutput,
    Context,
    ContextItem,
    ContinueCustomException,
    ContinueError,
    DeltaStep,
    Policy,
    SessionState,
    SessionUpdate,
    SetStep,
    Step,
    StepDescription,
    UpdateStep,
)
from .observation import Observation
from .sdk import ContinueSDK


def get_error_title(e: Exception) -> str:
    if isinstance(e, openai_errors.APIError):
        return "OpenAI is overloaded with requests. Please try again."
    elif isinstance(e, openai_errors.RateLimitError):
        return "This OpenAI API key has been rate limited. Please try again."
    elif isinstance(e, openai_errors.Timeout):
        return "OpenAI timed out. Please try again."
    elif (
        isinstance(e, openai_errors.InvalidRequestError)
        and e.code == "context_length_exceeded"
    ):
        return e._message or e.__str__()
    elif isinstance(e, ClientPayloadError):
        return "The request failed. Please try again."
    elif isinstance(e, openai_errors.APIConnectionError):
        return 'The request failed. Please check your internet connection and try again. If this issue persists, you can use our API key for free by going to VS Code settings and changing the value of continue.OPENAI_API_KEY to ""'
    elif isinstance(e, openai_errors.InvalidRequestError):
        return "Invalid request sent to OpenAI. Please try again."
    elif "rate_limit_ip_middleware" in e.__str__():
        return "You have reached your limit for free usage of our token. You can continue using Continue by entering your own OpenAI API key in VS Code settings."
    elif e.__str__().startswith("Cannot connect to host"):
        return (
            "The request failed. Please check your internet connection and try again."
        )
    return e.__str__() or e.__repr__()


class Autopilot:
    session_state: SessionState
    ide: AbstractIdeProtocolServer
    gui: AbstractGUIProtocolServer
    config: ContinueConfig
    context_manager: ContextManager

    context: Context = Context()

    def __init__(
        self,
        session_state: SessionState,
        ide: AbstractIdeProtocolServer,
        gui: AbstractGUIProtocolServer,
        config: ContinueConfig,
        context_manager: ContextManager,
    ):
        self.session_state = session_state
        self.ide = ide
        self.gui = gui
        self.config = config
        self.context_manager = context_manager

    @property
    def policy(self) -> Policy:
        return self.config.policy_override or DefaultPolicy()

    @property
    def sdk(self) -> ContinueSDK:
        return ContinueSDK(self.config, self.ide, self.gui, self)  # type: ignore because of circular import

    class Config:
        arbitrary_types_allowed = True

    def handle_error(self, e: Exception, step: Step) -> ContinueCustomException:
        is_continue_custom_exception = (
            issubclass(e.__class__, ContinueCustomException)
            or e.__class__.__name__ == ContinueCustomException.__name__
        )

        if is_continue_custom_exception:
            e = cast(ContinueCustomException, e)
            error_string = e.message
            error_title = e.title
        else:
            error_string = format_exc(e)
            error_title = get_error_title(e)

        # Attach an InternalErrorObservation to the step and unhide it.
        logger.error(f"Error while running step: \n{error_string}\n{error_title}")
        posthog_logger.capture_event(
            "step error",
            {
                "error_message": error_string,
                "error_title": error_title,
                "step_name": step.name,
                "params": step.dict(),
            },
        )

        if is_continue_custom_exception:
            return cast(ContinueCustomException, e)
        else:
            return ContinueCustomException(title=error_title, message=error_string)

    def log_step(self, step: Step, context_used: List[ContextItem]):
        posthog_logger.capture_event(
            "step run",
            {
                "step_name": step.name,
                "params": step.dict(),
                "context": list(
                    map(
                        lambda item: item.dict(),
                        context_used,
                    )
                ),
            },
        )
        step_id = uuid.uuid4().hex
        dev_data_logger.capture(
            "step_run",
            {"step_name": step.name, "params": step.dict(), "step_id": step_id},
        )
        dev_data_logger.capture(
            "context_used",
            {
                "context": list(
                    map(
                        lambda item: item.dict(),
                        context_used,
                    )
                ),
                "step_id": step_id,
            },
        )

    _step_depth: int = 0
    stopped = False

    async def _run_singular_step(self, step: "Step") -> AutopilotGenerator:
        # Allow config to set disallowed steps
        if (
            self.sdk.config.disallowed_steps is not None
            and step.__class__.__name__ in self.sdk.config.disallowed_steps
        ):
            return

        # Log the context and step to dev data
        context_used = self.session_state.context_items
        self.log_step(step, context_used)

        # Update history - do this first so we get top-first tree ordering
        self._step_depth += 1
        index = len(self.session_state.history)
        yield StepDescription(
            step_type=step.__class__.__name__,
            name=step.name,
            description=step.description,
            params=step.dict(),
            hide=step.hide,
            depth=self._step_depth,
        )

        def handle_step_update(
            update: UpdateStep,
        ) -> Optional[AutopilotGeneratorOutput]:
            if update.__class__.__name__ == "SessionUpdate":
                return update  # type: ignore
            elif isinstance(update, str):
                return SessionUpdate(index=index, update=DeltaStep(description=update))
            elif update.__class__.__name__ == "Observation":
                return SessionUpdate(
                    index=index,
                    update=DeltaStep(observations=[cast(Observation, update)]),
                )
            elif (
                update.__class__.__name__ == "DeltaStep"
                or update.__class__.__name__ == "SetStep"
            ):
                return SessionUpdate(index=index, update=update)
            elif update is None:
                return None
            else:
                logger.warning(f"Unknown type yielded from Step: {update}")

        # Try to run step and handle errors
        try:
            if inspect.iscoroutinefunction(step.run):
                await step.run(self.sdk)  # type: ignore (stub type)
            elif inspect.isasyncgenfunction(step.run):
                async for update in step.run(self.sdk):  # type: ignore (stub type)
                    if self.stopped:
                        if on_stop_generator := step.on_stop(self.sdk):  # type: ignore (stub type)
                            for update in on_stop_generator:  # type: ignore
                                if handled := handle_step_update(update):
                                    yield handled
                        return

                    if handled := handle_step_update(update):
                        yield handled
            else:
                logger.warning(
                    f"{step.__class__.__name__}.run is not a coroutine function or async generator"
                )

        except Exception as e:
            continue_custom_exception = self.handle_error(e, step)

            yield SessionUpdate(index=index, update=SetStep(hide=False))
            while self.session_state.history[index].name != step.name:
                yield SessionUpdate(index=index, update=SetStep(hide=True))
                index -= 1

            # i is now the index of the step that we want to show/rerun
            yield SessionUpdate(
                index=index,
                update=SetStep(
                    error=ContinueError(
                        title=continue_custom_exception.title,
                        message=continue_custom_exception.message,
                    ),
                    hide=False,
                ),
            )

            # ContinueCustomException can optionally specify a step to run on the error
            if after_err_step := continue_custom_exception.with_step:
                await self.run_step(after_err_step)

        self._step_depth -= 1

        # NOTE: index here doesn't matter, awkward
        yield SessionUpdate(index=index, stop=True, update=DeltaStep())

        # # Update its description
        # async def update_description():
        #     if (
        #         self.continue_sdk.config.disable_summaries
        #         or self.history.timeline[index_of_history_node].deleted
        #     ):
        #         return

        #     description = await step.describe(self.continue_sdk.models)
        #     if description is not None:
        #         step.description = description
        #     # Update subscribers with new description
        #     await self.update_subscribers()

        # create_async_task(
        #     update_description(),
        #     on_error=lambda e: self.continue_sdk.run_step(
        #         DisplayErrorStep.from_exception(e)
        #     ),
        # )

    async def run_step(self, step: Step):
        async for update in self._run_singular_step(step):
            await self.handle_session_update(update)

    async def handle_session_update(self, update: AutopilotGeneratorOutput):
        if update is None:
            return

        if isinstance(update, StepDescription):
            index = len(self.session_state.history)
            self.session_state.history.append(update)
            set_step = SetStep(**update.dict())
            await self.sdk.gui.send_session_update(
                SessionUpdate(index=index, update=set_step)
            )
            return

        if update.index > len(self.session_state.history):
            raise Exception(
                f"History update index {update.index} is greater than history length {len(self.session_state.history)}"
            )
        elif update.index == len(self.session_state.history):
            raise Exception(
                f"History update index {update.index} is equal to history length {len(self.session_state.history)}. Must yield a StepDescription to add a new step."
            )

        self.session_state.history[update.index].update(update.update)
        await self.sdk.gui.send_session_update(update)

    async def run(self, step: Optional[Step] = None):
        async def add_log(log: str):
            await self.handle_session_update(
                SessionUpdate(
                    index=len(self.session_state.history) - 1,
                    update=DeltaStep(logs=[log]),
                )
            )

        logger_id = self.sdk.models.add_logger(add_log)

        if step is not None:
            await self.run_step(step)
        while next_step := self.policy.next(self.sdk.config, self.session_state):  # type: ignore (stub type)
            await self.run_step(next_step)

        self.sdk.models.remove_logger(logger_id)

    async def get_session_title(self) -> str:
        if self.sdk.config.disable_summaries:
            return "New Session"
        else:
            chat_history = await self.sdk.get_chat_context()
            chat_history_str = template_alpaca_messages(chat_history)
            if self.sdk.models.summarize is None:
                return "New Session"

            title = await self.sdk.models.summarize.complete(
                f"{chat_history_str}\n\nGive a short title to describe the above chat session. Do not put quotes around the title. Do not use more than 6 words. The title is: ",
                max_tokens=20,
                log=False,
            )
            return remove_quotes_and_escapes(title)
