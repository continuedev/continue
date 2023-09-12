import html
import json
import os
from textwrap import dedent
from typing import Any, Coroutine, List

import openai
from directory_tree import display_tree
from dotenv import load_dotenv
from pydantic import Field

from ...core.main import ChatMessage, FunctionCall, Models, Step, step_to_json_schema
from ...core.sdk import ContinueSDK
from ...libs.llm.maybe_proxy_openai import MaybeProxyOpenAI
from ...libs.llm.openai import OpenAI
from ...libs.util.devdata import dev_data_logger
from ...libs.util.strings import remove_quotes_and_escapes
from ...libs.util.telemetry import posthog_logger
from .core.core import MessageStep
from .main import EditHighlightedCodeStep

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai.api_key = OPENAI_API_KEY

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

    async def run(self, sdk: ContinueSDK):
        # Check if proxy server API key
        if (
            isinstance(sdk.models.default, MaybeProxyOpenAI)
            and (
                sdk.models.default.api_key is None
                or sdk.models.default.api_key.strip() == ""
            )
            and len(list(filter(lambda x: not x.step.hide, sdk.history.timeline))) >= 10
            and len(
                list(
                    filter(
                        lambda x: x.step.name == FREE_USAGE_STEP_NAME,
                        sdk.history.timeline,
                    )
                )
            )
            == 0
        ):
            await sdk.run_step(
                MessageStep(
                    name=FREE_USAGE_STEP_NAME,
                    message=dedent(
                        """\
                                To make it easier to use Continue, you're getting limited free usage. When you have the chance, please enter your own OpenAI key in `~/.continue/config.py`. You can open the file by using the '/config' slash command in the text box below.
                                
                                Here's an example of how to edit the file:
                                ```python
                                ...
                                config=ContinueConfig(
                                    ...
                                    models=Models(
                                        default=MaybeProxyOpenAI(api_key="<API_KEY>", model="gpt-4"),
                                        medium=MaybeProxyOpenAI(api_key="<API_KEY>", model="gpt-3.5-turbo")
                                    )
                                )
                               ```

                               You can also learn more about customizations [here](https://continue.dev/docs/customization).
                               """
                    ),
                )
            )

        messages = self.messages or await sdk.get_chat_context()

        generator = sdk.models.chat.stream_chat(
            messages, temperature=sdk.config.temperature
        )

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
                self.hide = False
                await sdk.update_ui()
                break

            if "content" in chunk:
                self.description += chunk["content"]

                # HTML unencode
                end_size = len(chunk["content"]) - 6
                if "&" in self.description[-end_size:]:
                    self.description = self.description[:-end_size] + html.unescape(
                        self.description[-end_size:]
                    )

                await sdk.update_ui()

        if sdk.config.disable_summaries:
            self.name = ""
        else:
            self.name = "Generating title..."
            await sdk.update_ui()
            self.name = add_ellipsis(
                remove_quotes_and_escapes(
                    await sdk.models.medium.complete(
                        f'"{self.description}"\n\nPlease write a short title summarizing the message quoted above. Use no more than 10 words:',
                        max_tokens=20,
                    )
                ),
                200,
            )

        await sdk.update_ui()

        self.chat_context.append(
            ChatMessage(role="assistant", content=self.description, summary=self.name)
        )

        # TODO: Never actually closing.
        await generator.aclose()


class AddFileStep(Step):
    name: str = "Add File"
    description = "Add a file to the workspace. Should always view the directory tree before this."
    filename: str
    file_contents: str

    async def describe(
        self, models: Models
    ) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return f"Added a file named `{self.filename}` to the workspace."

    async def run(self, sdk: ContinueSDK):
        await sdk.add_file(self.filename, self.file_contents)

        await sdk.ide.setFileOpen(
            os.path.join(sdk.ide.workspace_directory, self.filename)
        )


class DeleteFileStep(Step):
    name: str = "Delete File"
    description = "Delete a file from the workspace."
    filename: str

    async def describe(
        self, models: Models
    ) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return f"Deleted a file named `{self.filename}` from the workspace."

    async def run(self, sdk: ContinueSDK):
        await sdk.delete_file(self.filename)


class AddDirectoryStep(Step):
    name: str = "Add Directory"
    description = "Add a directory to the workspace."
    directory_name: str

    async def describe(
        self, models: Models
    ) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return f"Added a directory named `{self.directory_name}` to the workspace."

    async def run(self, sdk: ContinueSDK):
        try:
            await sdk.add_directory(self.directory_name)
        except FileExistsError:
            self.description = f"Directory {self.directory_name} already exists."


class RunTerminalCommandStep(Step):
    name: str = "Run Terminal Command"
    description: str = "Run a terminal command."
    command: str

    async def run(self, sdk: ContinueSDK):
        self.description = f"Copy this command and run in your terminal:\n\n```bash\n{self.command}\n```"


class ViewDirectoryTreeStep(Step):
    name: str = "View Directory Tree"
    description: str = "View the directory tree to learn which folder and files exist. You should always do this before adding new files."

    async def describe(
        self, models: Models
    ) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return "Viewed the directory tree."

    async def run(self, sdk: ContinueSDK):
        self.description = (
            f"```\n{display_tree(sdk.ide.workspace_directory, True, max_depth=2)}\n```"
        )


class EditFileStep(Step):
    name: str = "Edit File"
    description: str = "Edit a file in the workspace that is not currently open."
    filename: str = Field(..., description="The name of the file to edit.")
    instructions: str = Field(..., description="The instructions to edit the file.")
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.edit_file(self.filename, self.instructions)


class ChatWithFunctions(Step):
    user_input: str
    functions: List[Step] = [
        AddFileStep(filename="", file_contents=""),
        EditFileStep(filename="", instructions=""),
        EditHighlightedCodeStep(user_input=""),
        ViewDirectoryTreeStep(),
        AddDirectoryStep(directory_name=""),
        DeleteFileStep(filename=""),
        RunTerminalCommandStep(command=""),
    ]
    name: str = "Input"
    manage_own_chat_context: bool = True
    description: str = ""
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.update_ui()

        step_name_step_class_map = {
            step.name.replace(" ", ""): step.__class__ for step in self.functions
        }

        functions = [step_to_json_schema(function) for function in self.functions]

        self.chat_context.append(
            ChatMessage(role="user", content=self.user_input, summary=self.user_input)
        )

        last_function_called_name = None
        last_function_called_params = None
        while True:
            was_function_called = False
            func_args = ""
            func_name = ""
            msg_content = ""
            msg_step = None

            gpt350613 = OpenAI(model="gpt-3.5-turbo-0613")
            await sdk.start_model(gpt350613)

            async for msg_chunk in gpt350613.stream_chat(
                await sdk.get_chat_context(), functions=functions
            ):
                if sdk.current_step_was_deleted():
                    return

                if "content" in msg_chunk and msg_chunk["content"] is not None:
                    msg_content += msg_chunk["content"]
                    # if last_function_called_index_in_history is not None:
                    #     while sdk.history.timeline[last_function_called_index].step.hide:
                    #         last_function_called_index += 1
                    #     sdk.history.timeline[last_function_called_index_in_history].step.description = msg_content
                    if msg_step is None:
                        msg_step = MessageStep(
                            name="Chat", message=msg_chunk["content"]
                        )
                        await sdk.run_step(msg_step)
                    else:
                        msg_step.description = msg_content
                    await sdk.update_ui()
                elif "function_call" in msg_chunk or func_name != "":
                    was_function_called = True
                    if "function_call" in msg_chunk:
                        if "arguments" in msg_chunk["function_call"]:
                            func_args += msg_chunk["function_call"]["arguments"]
                        if "name" in msg_chunk["function_call"]:
                            func_name += msg_chunk["function_call"]["name"]

            if not was_function_called:
                self.chat_context.append(
                    ChatMessage(
                        role="assistant", content=msg_content, summary=msg_content
                    )
                )
                break
            else:
                if func_name == "python" and "python" not in step_name_step_class_map:
                    # GPT must be fine-tuned to believe this exists, but it doesn't always
                    func_name = "EditHighlightedCodeStep"
                    func_args = json.dumps({"user_input": self.user_input})
                    # self.chat_context.append(ChatMessage(
                    #     role="assistant",
                    #     content=None,
                    #     function_call=FunctionCall(
                    #         name=func_name,
                    #         arguments=func_args
                    #     ),
                    #     summary=f"Called function {func_name}"
                    # ))
                    # self.chat_context.append(ChatMessage(
                    #     role="user",
                    #     content="The 'python' function does not exist. Don't call it. Try again to call another function.",
                    #     summary="'python' function does not exist."
                    # ))
                    # msg_step.hide = True
                    # continue
                # Call the function, then continue to chat
                func_args = "{}" if func_args == "" else func_args
                try:
                    fn_call_params = json.loads(func_args)
                except json.JSONDecodeError:
                    raise Exception("The model returned invalid JSON. Please try again")
                self.chat_context.append(
                    ChatMessage(
                        role="assistant",
                        content=None,
                        function_call=FunctionCall(name=func_name, arguments=func_args),
                        summary=f"Called function {func_name}",
                    )
                )
                sdk.history.current_index + 1
                if func_name not in step_name_step_class_map:
                    raise Exception(
                        f"The model tried to call a function ({func_name}) that does not exist. Please try again."
                    )

                # if func_name == "AddFileStep":
                #     step_to_run.hide = True
                #     self.description += f"\nAdded file `{func_args['filename']}`"
                # elif func_name == "AddDirectoryStep":
                #     step_to_run.hide = True
                #     self.description += f"\nAdded directory `{func_args['directory_name']}`"
                # else:
                #     self.description += f"\n`Running function {func_name}`\n\n"
                if func_name == "EditHighlightedCodeStep":
                    fn_call_params["user_input"] = self.user_input
                elif func_name == "EditFile":
                    fn_call_params["instructions"] = self.user_input

                step_to_run = step_name_step_class_map[func_name](**fn_call_params)
                if (
                    last_function_called_name is not None
                    and last_function_called_name == func_name
                    and last_function_called_params is not None
                    and last_function_called_params == fn_call_params
                ):
                    # If it's calling the same function more than once in a row, it's probably looping and confused
                    return
                last_function_called_name = func_name
                last_function_called_params = fn_call_params

                await sdk.run_step(step_to_run)
                await sdk.update_ui()
