import html
from typing import List, Optional

from ...libs.llm.base import CompletionOptions

from ...core.main import ChatMessage, DeltaStep, SetStep, Step
from ...core.sdk import ContinueSDK
from ...libs.util.devdata import dev_data_logger
from ...libs.util.strings import remove_quotes_and_escapes
from ...libs.util.telemetry import posthog_logger

FREE_USAGE_STEP_NAME = "Please enter OpenAI API key"


def add_ellipsis(text: str, max_length: int = 200) -> str:
    if len(text) > max_length:
        return text[: max_length - 3] + "..."
    return text


class SimpleChatStep(Step):
    name: str = "Generating Response..."
    manage_own_chat_context: bool = True
    description: str = ""
    messages: List[ChatMessage] = None

    completion_options: Optional[CompletionOptions] = None

    async def run(self, sdk: ContinueSDK):
        messages = self.messages or await sdk.get_chat_context()

        kwargs = self.completion_options.dict() if self.completion_options else {}
        generator = sdk.models.chat.stream_chat(messages, **kwargs)

        posthog_logger.capture_event(
            "model_use",
            {
                "model": sdk.models.default.model,
                "provider": sdk.models.default.__class__.__name__,
            },
        )
        dev_data_logger.capture(
            "model_use",
            {
                "model": sdk.models.default.model,
                "provider": sdk.models.default.__class__.__name__,
            },
        )

        async for chunk in generator:
            if sdk.current_step_was_deleted():
                # So that the message doesn't disappear
                yield DeltaStep(hide=False)
                break

            if "content" in chunk:
                yield chunk["content"]

                # HTML unencode
                end_size = len(chunk["content"]) - 6
                if "&" in self.description[-end_size:]:
                    self.description = self.description[:-end_size] + html.unescape(
                        self.description[-end_size:]
                    )

        if sdk.config.disable_summaries:
            self.name = ""
        else:
            yield SetStep(name="Generating title...")
            yield SetStep(
                name=add_ellipsis(
                    remove_quotes_and_escapes(
                        await sdk.models.summarize.complete(
                            f'"{self.description}"\n\nPlease write a short title summarizing the message quoted above. Use no more than 10 words:',
                            max_tokens=20,
                            log=False,
                        )
                    ),
                    200,
                )
            )

        self.chat_context.append(
            ChatMessage(role="assistant", content=self.description, summary=self.name)
        )

        # TODO: Never actually closing.
        await generator.aclose()
