import json
from typing import Any, Coroutine, List

from .main import EditHighlightedCodeStep
from .core.core import MessageStep
from ..core.main import FunctionCall, Models
from ..core.main import ChatMessage, Step, step_to_json_schema
from ..core.sdk import ContinueSDK
import openai
import os
from dotenv import load_dotenv
from directory_tree import display_tree

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai.api_key = OPENAI_API_KEY


class SimpleChatStep(Step):
    user_input: str
    name: str = "Chat"

    async def run(self, sdk: ContinueSDK):
        self.description = f"```{self.user_input}```\n\n"
        await sdk.update_ui()

        async for chunk in sdk.models.default.stream_complete(self.user_input, with_history=await sdk.get_chat_context()):
            self.description += chunk
            await sdk.update_ui()

        self.name = (await sdk.models.gpt35.complete(
            f"Write a short title for the following chat message: {self.description}")).strip()


class AddFileStep(Step):
    name: str = "Add File"
    description = "Add a file to the workspace."
    filename: str
    file_contents: str

    async def describe(self, models: Models) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return f"Added a file named {self.filename} to the workspace."

    async def run(self, sdk: ContinueSDK):
        try:
            await sdk.add_file(self.filename, self.file_contents)
        except FileNotFoundError:
            self.description = f"File {self.filename} does not exist."
            return
        currently_open_file = (await sdk.ide.getOpenFiles())[0]
        await sdk.ide.setFileOpen(os.path.join(sdk.ide.workspace_directory, self.filename))
        await sdk.ide.setFileOpen(currently_open_file)


class DeleteFileStep(Step):
    name: str = "Delete File"
    description = "Delete a file from the workspace."
    filename: str

    async def describe(self, models: Models) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return f"Deleted a file named {self.filename} from the workspace."

    async def run(self, sdk: ContinueSDK):
        await sdk.delete_file(self.filename)


class AddDirectoryStep(Step):
    name: str = "Add Directory"
    description = "Add a directory to the workspace."
    directory_name: str

    async def describe(self, models: Models) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return f"Added a directory named {self.directory_name} to the workspace."

    async def run(self, sdk: ContinueSDK):
        try:
            await sdk.add_directory(self.directory_name)
        except FileExistsError:
            self.description = f"Directory {self.directory_name} already exists."


class RunTerminalCommandStep(Step):
    name: str = "Run Terminal Command"
    description: str = "Run a terminal command."
    command: str

    async def describe(self, models: Models) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return f"Ran the terminal command {self.command}."

    async def run(self, sdk: ContinueSDK):
        await sdk.wait_for_user_confirmation(f"Run the terminal command {self.command}?")
        await sdk.run(self.command)


class ViewDirectoryTreeStep(Step):
    name: str = "View Directory Tree"
    description: str = "View the directory tree to learn which folder and files exist."

    async def describe(self, models: Models) -> Coroutine[Any, Any, Coroutine[str, None, None]]:
        return f"Viewed the directory tree."

    async def run(self, sdk: ContinueSDK):
        self.description = f"```\n{display_tree(sdk.ide.workspace_directory, True)}\n```"


class EditFileStep(Step):
    name: str = "Edit File"
    description: str = "Edit a file in the workspace."
    filename: str
    instructions: str
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.edit_file(self.filename, self.instructions)


class ChatWithFunctions(Step):
    user_input: str
    functions: List[Step] = [AddFileStep(filename="", file_contents=""),
                             EditFileStep(filename="", instructions=""),
                             EditHighlightedCodeStep(user_input=""),
                             ViewDirectoryTreeStep(), AddDirectoryStep(directory_name=""),
                             DeleteFileStep(filename=""), RunTerminalCommandStep(command="")]
    name: str = "Chat"
    manage_own_chat_context: bool = True

    async def run(self, sdk: ContinueSDK):
        self.description = f"```{self.user_input}```\n\nDeciding next steps...\n\n"
        await sdk.update_ui()

        step_name_step_class_map = {
            step.name.replace(" ", ""): step.__class__ for step in self.functions}

        functions = [step_to_json_schema(
            function) for function in self.functions]

        self.chat_context.append(ChatMessage(
            role="user",
            content=self.user_input,
            summary=self.user_input
        ))

        last_function_called_index_in_history = None
        while True:
            was_function_called = False
            func_args = ""
            func_name = ""
            msg_content = ""
            msg_step = None

            async for msg_chunk in sdk.models.gpt350613.stream_chat(await sdk.get_chat_context(), functions=functions):
                if "content" in msg_chunk and msg_chunk["content"] is not None:
                    msg_content += msg_chunk["content"]
                    # if last_function_called_index_in_history is not None:
                    #     while sdk.history.timeline[last_function_called_index].step.hide:
                    #         last_function_called_index += 1
                    #     sdk.history.timeline[last_function_called_index_in_history].step.description = msg_content
                    if msg_step is None:
                        msg_step = MessageStep(
                            name="Chat",
                            message=msg_chunk["content"]
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
                self.chat_context.append(ChatMessage(
                    role="assistant",
                    content=msg_content,
                    summary=msg_content
                ))
                break
            else:
                if func_name == "python" and "python" not in step_name_step_class_map:
                    # GPT must be fine-tuned to believe this exists, but it doesn't always
                    self.chat_context.append(ChatMessage(
                        role="user",
                        content="The 'python' function does not exist. Don't call it.",
                        summary="'python' function does not exist."
                    ))
                    continue
                # Call the function, then continue to chat
                func_args = "{}" if func_args == "" else func_args
                fn_call_params = json.loads(func_args)
                self.chat_context.append(ChatMessage(
                    role="assistant",
                    content=None,
                    function_call=FunctionCall(
                        name=func_name,
                        arguments=func_args
                    ),
                    summary=f"Ran function {func_name}"
                ))
                last_function_called_index_in_history = sdk.history.current_index + 1
                await sdk.run_step(step_name_step_class_map[func_name](
                    **fn_call_params))
                self.description += f"`Running function {func_name}`\n\n"
                await sdk.update_ui()
