# Codebase Embeddings (Experimental)

We're sharing an early look at an experimental plugin: codebase embeddings. By using the /codebase slash command, you will be able to ask a question and Continue will use similarity search to find the most relevant files to answer the question.

While it is experimental, codebase embeddings will only be available through the PyPI package. Here are the steps to get started:

1. In VS Code settings (cmd+,), search for "continue" and check the box that says "Manually Running Server"
2. `pip install --upgrade continuedev` to install the Continue PyPI package
3. `python -m continuedev` to start the Continue server
4. Open `~/.continue/config.py` and add the following, filling in your OpenAI API key:

> NOTE: All of the `params` are optional. If you don't provide an OpenAI API key, sentence transformers embeddings will be calculated locally. And the values seen in this example for the other parameters are the defaults so you can leave them out.

```python
from continuedev.plugins.steps.chroma import (
    AnswerQuestionChroma,
    CreateCodebaseIndexChroma,
)
...

config=ContinueConfig(
    steps_on_startup=[
        CreateCodebaseIndexChroma(
            openai_api_key="<OPENAI_API_KEY>"
        )
    ],
    ...
    slash_commands=[
        ...
        SlashCommand(
            name="codebase",
            description="Answer question after embeddings-based retrieval",
            step=AnswerQuestionChroma,
            params={
                "n_retrieve": 20,
                "n_final": 10,
                "use_reranking": True,
                "sentence_transformers_model": "openai"
            },
        ),
    ]
)
```

5. Reload the VS Code window to connect to the server you are running manually and allow the config changes to take effect
6. When you open a workspace, Continue will generate the embeddings. You can then enter '/codebase \<QUESTION\>' to ask a question with embeddings-based retrieval.
7. Please share feedback in [Discord](https://discord.gg/NWtdYexhMs)!

## Parameters

After retrieving the top `n_retrieve` results from the vector database, an additional re-reranking step uses 2 LLM calls to select the top `n_final` results to use to answer the question. If you want to increase the speed of the query at the cost of relevancy, you can skip the re-ranking step by setting `use_reranking` to `False`. Then the top `n_final` results will just be directly calculated from the vector database.

The `sentence_transformers_model` parameter allows you to select a custom embeddings model from the list [here](https://www.sbert.net/docs/pretrained_models.html). The default value is "openai", but if you don't include your OpenAI API key, it will fall back to using the `all-MiniLM-L6-v2` sentence transformers model.
