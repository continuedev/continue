from textwrap import dedent
from typing import List

from anthropic import AI_PROMPT, HUMAN_PROMPT

from ....core.main import ChatMessage


def anthropic_template_messages(messages: List[ChatMessage]) -> str:
    prompt = ""

    # Anthropic prompt must start with a Human turn
    if (
        len(messages) > 0
        and messages[0].role != "user"
        and messages[0].role != "system"
    ):
        prompt += f"{HUMAN_PROMPT} Hello."
    for msg in messages:
        prompt += f"{HUMAN_PROMPT if (msg.role == 'user' or msg.role == 'system') else AI_PROMPT} {msg.content} "

    prompt += AI_PROMPT
    return prompt


def zephyr_template_messages(msgs: List[ChatMessage]) -> str:
    """ "
    <|system|>
    </s>
    <|user|>
    {prompt}</s>
    <|assistant|>
    """
    prompt = ""

    if msgs[0].role == "system":
        prompt += f"<|system|>{msgs[0].content}</s>\n"
        msgs.pop(0)
    else:
        prompt += "<|system|> </s>\n"

    for msg in msgs:
        prompt += "<|user|>\n" if msg.role == "user" else "<|assistant|>\n"
        prompt += f"{msg.content}</s>\n"

    prompt += "<|assistant|>\n"

    return prompt


def chatml_template_messages(messages: List[ChatMessage]) -> str:
    prompt = ""

    for msg in messages:
        prompt += f"<|im_start|>{msg.role}\n{msg.content}<|im_end|>\n"

    prompt += "<|im_start|>assistant\n"
    return prompt


def template_alpaca_messages(msgs: List[ChatMessage]) -> str:
    prompt = ""

    if msgs[0].role == "system":
        prompt += f"{msgs[0].content}\n\n"
        msgs.pop(0)

    for msg in msgs:
        prompt += "### Instruction:\n" if msg.role == "user" else "### Response:\n"
        prompt += f"{msg.content}\n\n"

    prompt += "### Response:\n"

    return prompt


def deepseek_template_messages(msgs: List[ChatMessage]) -> str:
    prompt = ""
    system = None
    prompt += "You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and you only answer questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will refuse to answer.\n"
    if msgs[0].role == "system":
        system = msgs.pop(0).content

    for i in range(len(msgs)):
        msg = msgs[i]
        prompt += "### Instruction:\n" if msg.role == "user" else "### Response:\n"

        if system and msg.role == "user" and i == len(msgs) - 1:
            prompt += system + "\n"

        prompt += f"{msg.content}"
        prompt += "\n" if msg.role == "user" else "<|EOT|>\n"

    return prompt + "### Response:\n"


def phind_template_messages(msgs: List[ChatMessage]) -> str:
    prompt = ""

    if msgs[0].role == "system":
        prompt += f"### System Prompt\n{msgs[0].content}\n\n"
        msgs.pop(0)

    for msg in msgs:
        prompt += "### User Message\n" if msg.role == "user" else "### Assistant\n"
        prompt += f"{msg.content}\n"

    prompt += "### Assistant\n"

    return prompt


def raw_input_template(msgs: List[ChatMessage]) -> str:
    return msgs[-1].content


SQL_CODER_DEFAULT_SCHEMA = """\
CREATE TABLE products (
  product_id INTEGER PRIMARY KEY, -- Unique ID for each product
  name VARCHAR(50), -- Name of the product
  price DECIMAL(10,2), -- Price of each unit of the product
  quantity INTEGER  -- Current quantity in stock
);

CREATE TABLE customers (
   customer_id INTEGER PRIMARY KEY, -- Unique ID for each customer
   name VARCHAR(50), -- Name of the customer
   address VARCHAR(100) -- Mailing address of the customer
);

CREATE TABLE salespeople (
  salesperson_id INTEGER PRIMARY KEY, -- Unique ID for each salesperson
  name VARCHAR(50), -- Name of the salesperson
  region VARCHAR(50) -- Geographic sales region
);

CREATE TABLE sales (
  sale_id INTEGER PRIMARY KEY, -- Unique ID for each sale
  product_id INTEGER, -- ID of product sold
  customer_id INTEGER,  -- ID of customer who made purchase
  salesperson_id INTEGER, -- ID of salesperson who made the sale
  sale_date DATE, -- Date the sale occurred
  quantity INTEGER -- Quantity of product sold
);

CREATE TABLE product_suppliers (
  supplier_id INTEGER PRIMARY KEY, -- Unique ID for each supplier
  product_id INTEGER, -- Product ID supplied
  supply_price DECIMAL(10,2) -- Unit price charged by supplier
);

-- sales.product_id can be joined with products.product_id
-- sales.customer_id can be joined with customers.customer_id
-- sales.salesperson_id can be joined with salespeople.salesperson_id
-- product_suppliers.product_id can be joined with products.product_id
"""


def _sqlcoder_template_messages(
    msgs: List[ChatMessage], schema: str = SQL_CODER_DEFAULT_SCHEMA
) -> str:
    question = msgs[-1].content
    return f"""\
Your task is to convert a question into a SQL query, given a Postgres database schema.
Adhere to these rules:
- **Deliberately go through the question and database schema word by word** to appropriately answer the question
- **Use Table Aliases** to prevent ambiguity. For example, `SELECT table1.col1, table2.col1 FROM table1 JOIN table2 ON table1.id = table2.id`.
- When creating a ratio, always cast the numerator as float

### Input:
Generate a SQL query that answers the question `{question}`.
This query will run on a database whose schema is represented in this string:
{schema}

### Response:
Based on your instructions, here is the SQL query I have generated to answer the question `{question}`:
```sql
"""


def sqlcoder_template_messages(schema: str = SQL_CODER_DEFAULT_SCHEMA):
    if schema in {"<MY_DATABASE_SCHEMA>", ""}:
        schema = SQL_CODER_DEFAULT_SCHEMA

    def fn(msgs):
        return _sqlcoder_template_messages(msgs, schema=schema)

    fn.__name__ = "sqlcoder_template_messages"
    return fn


def llama2_template_messages(msgs: List[ChatMessage]) -> str:
    if len(msgs) == 0:
        return ""

    if msgs[0].role == "assistant":
        # These models aren't trained to handle assistant message coming first,
        # and typically these are just introduction messages from Continue
        msgs.pop(0)

    prompt = ""
    has_system = msgs[0].role == "system"

    if has_system and msgs[0].content.strip() == "":
        has_system = False
        msgs = msgs[1:]

    if has_system:
        system_message = dedent(
            f"""\
                <<SYS>>
                {msgs[0].content}
                <</SYS>>
                
                """
        )
        if len(msgs) > 1:
            prompt += f"[INST] {system_message}{msgs[1].content} [/INST]"
        else:
            prompt += f"[INST] {system_message} [/INST]"
            return prompt

    for i in range(2 if has_system else 0, len(msgs)):
        if msgs[i].role == "user":
            prompt += f"[INST] {msgs[i].content} [/INST]"
        else:
            prompt += msgs[i].content + " "

    return prompt


def code_llama_template_messages(msgs: List[ChatMessage]) -> str:
    return f"[INST] {msgs[-1].content}\n[/INST]"


def extra_space_template_messages(msgs: List[ChatMessage]) -> str:
    return f" {msgs[-1].content}"


def code_llama_python_template_messages(msgs: List[ChatMessage]) -> str:
    return dedent(
        f"""\
        [INST]
        You are an expert Python programmer and personal assistant, here is your task: {msgs[-1].content}
        Your answer should start with a [PYTHON] tag and end with a [/PYTHON] tag.
        [/INST]"""
    )
