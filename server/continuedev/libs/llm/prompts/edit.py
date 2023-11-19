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

_alpaca_edit_prompt = dedent(
    """\
            Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

            ### Instruction: Rewrite the code to satisfy this request: "{{{user_input}}}"

            ### Input:

            ```
            {{{code_to_edit}}}
            ```

            ### Response:
            
            Sure! Here's the code you requested:
            ```
            """
)

_phind_edit_prompt = dedent(
    """\
            ### System Prompt
            You are an expert programmer and write code on the first attempt without any errors or fillers.

            ### User Message:
            Rewrite the code to satisfy this request: "{{{user_input}}}"

            ```
            {{{code_to_edit}}}
            ```

            ### Assistant:
            Sure! Here's the code you requested:

            ```
            """
)

_deepseek_edit_prompt = dedent(
    """\
            ### System Prompt
            You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and you only answer questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will refuse to answer.
            ### Instruction:
            Rewrite the code to satisfy this request: "{{{user_input}}}"

            ```
            {{{code_to_edit}}}
            ```<|EOT|>
            ### Response:
            Sure! Here's the code you requested:

            ```
            """
)

_zephyr_edit_prompt = dedent(
    """\
            <|system|>
            You are an expert programmer and write code on the first attempt without any errors or fillers.</s>
            <|user|>
            Rewrite the code to satisfy this request: "{{{user_input}}}"

            ```
            {{{code_to_edit}}}
            ```</s>
            <|assistant|>
            Sure! Here's the code you requested:
            
            ```
            """
)


codellama_edit_prompt = PromptTemplate(
    prompt=_codellama_edit_prompt, raw=True, stop=["[/CODE]"]
)
alpaca_edit_prompt = PromptTemplate(prompt=_alpaca_edit_prompt, raw=True, stop=["```"])
phind_edit_prompt = PromptTemplate(prompt=_phind_edit_prompt, raw=True, stop=["```"])
zephyr_edit_prompt = PromptTemplate(prompt=_zephyr_edit_prompt, raw=True, stop=["```"])
deepseek_edit_prompt = PromptTemplate(
    prompt=_deepseek_edit_prompt, raw=True, stop=["```"]
)
