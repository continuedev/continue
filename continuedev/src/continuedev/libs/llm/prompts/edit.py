from textwrap import dedent

simplified_edit_prompt = dedent(
    """\
            Consider the following code:
            ```
            {{code_to_edit}}
            ```
            Edit the code to perfectly satisfy the following user request:
            {{user_input}}
            Output nothing except for the code. No code block, no English explanation, no start/end tags."""
)

simplest_edit_prompt = dedent(
    """\
            Here is the code before editing:
            ```
            {{code_to_edit}}
            ```

            Here is the edit requested:
            "{{user_input}}"
            
            Here is the code after editing:"""
)

codellama_infill_edit_prompt = "{{file_prefix}}<FILL>{{file_suffix}}"
