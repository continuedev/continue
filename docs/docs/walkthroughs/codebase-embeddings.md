---
title: Codebase Embeddings (Experimental)
description: Talk to your codebase
keywords: [talk, embeddings, codebase, experimental]
---

# Codebase Embeddings (Experimental)

We're sharing an early look at an experimental plugin: codebase embeddings. By using the /codebase slash command, you will be able to ask a question and Continue will use similarity search to find the most relevant files to answer the question.

While it is experimental, codebase embeddings will only be available through the VS Code pre-release. Here are the steps to get started:

1. In the VS Code extension settings, select Continue and click the "Switch to Pre-release Version" button
2. Unless you are downloading Continue for the first time, open `~/.continue/config.py` and add the following, filling in your OpenAI API key:

> NOTE: All of the `params` are optional. If you don't provide an OpenAI API key, sentence transformers embeddings will be calculated locally with `all-MiniLM-L6-v2`. The values seen in this example for the other parameters are the defaults so you can leave them out.

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
                "openai_api_key": "<API_KEY>"
            },
        ),
    ]
)
```

3. Reload the VS Code window to allow config changes to take effect, and for the indexing step to run
4. When you open a workspace, Continue will generate the embeddings. You can then enter '/codebase \<QUESTION\>' to ask a question with embeddings-based retrieval.
5. Please share feedback in [Discord](https://discord.gg/NWtdYexhMs)!

## Parameters

After retrieving the top `n_retrieve` results from the vector database, an additional re-reranking step uses 2 LLM calls to select the top `n_final` results to use to answer the question. If you want to increase the speed of the query at the cost of relevancy, you can skip the re-ranking step by setting `use_reranking` to `False`. Then the top `n_final` results will just be directly calculated from the vector database.

It is optional to set your `openai_api_key` parameter. If you do, we will use their Ada embeddings. Otherwise, a sentence transformers model will be run locally to calculate the embeddings.
