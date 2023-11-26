import pytest
from continuedev.core.main import ChatMessage
from continuedev.libs.llm.prompts.chat import (
    anthropic_template_messages,
    chatml_template_messages,
    code_llama_template_messages,
    llama2_template_messages,
    phind_template_messages,
    template_alpaca_messages,
    zephyr_template_messages,
)


@pytest.mark.parametrize(
    "template,expected",
    [
        (
            template_alpaca_messages,
            """Always be kind

### Instruction:
Hello!

### Response:
""",
        ),
        (
            zephyr_template_messages,
            """<|system|>Always be kind</s>
<|user|>
Hello!</s>
<|assistant|>
""",
        ),
        (
            chatml_template_messages,
            """<|im_start|>system
Always be kind<|im_end|>
<|im_start|>user
Hello!<|im_end|>
<|im_start|>assistant
""",
        ),
        (
            phind_template_messages,
            """### System Prompt
Always be kind

### User Message
Hello!
### Assistant
""",
        ),
        (
            anthropic_template_messages,
            """

Human: Always be kind 

Human: Hello! 

Assistant:""",
        ),
        (
            llama2_template_messages,
            """[INST] <<SYS>>
Always be kind
<</SYS>>

Hello! [/INST]""",
        ),
        (
            code_llama_template_messages,
            """[INST] Hello!
[/INST]""",
        ),
    ],
)
def test_template_messages(template, expected):
    templated = template(
        [
            ChatMessage(role="system", content="Always be kind"),
            ChatMessage(role="user", content="Hello!"),
        ]
    )
    print(templated)
    assert templated == expected
