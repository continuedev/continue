from textwrap import dedent

simplified_edit_prompt = dedent(
    """\
            [INST] Consider the following code:
            ```
            {{code_to_edit}}
            ```
            Edit the code to perfectly satisfy the following user request:
            {{user_input}}
            Output nothing except for the code. No code block, no English explanation, no start/end tags.
            [/INST]"""
)
