from textwrap import dedent

from ....models.llm import PromptTemplate

simplified_edit_prompt = dedent(
    """\
            Consider the following code:
            ```
            {{{code_to_edit}}}
            ```
            Edit the code to perfectly satisfy the following user request:
            {{{user_input}}}
            Output nothing except for the code. No code block, no English explanation, no start/end tags."""
)

simplest_edit_prompt = dedent(
    """\
            Here is the code before editing:
            ```
            {{{code_to_edit}}}
            ```

            Here is the edit requested:
            "{{{user_input}}}"
            
            Here is the code after editing:"""
)

codellama_infill_edit_prompt = "{{file_prefix}}<FILL>{{file_suffix}}"

_codellama_edit_prompt = dedent(
    """\
            [CODE]
            {{{code_to_edit}}}
            [/CODE]
            [INST]
            You are an expert programmer and personal assistant, here is your task: "Rewrite the above code in order to {{{user_input}}}"

            Your answer should start with a [CODE] tag and end with a [/CODE] tag.
            [/INST] Sure! Here's the code you requested:
            [CODE]"""
)

codellama_edit_prompt = PromptTemplate(
    prompt=_codellama_edit_prompt, raw=True, stop=["[/CODE]"]
)

_alpaca_edit_prompt = dedent(
    """\
            Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

            ### Instruction: Rewrite the code to satisfy this request: "{{{user_input}}}"

            ### Input:

            ```
            {{{code_to_edit}}}
            ```

            ### Response:
            
            ```
            """
)

alpaca_edit_prompt = PromptTemplate(prompt=_alpaca_edit_prompt, raw=True, stop=["```"])
