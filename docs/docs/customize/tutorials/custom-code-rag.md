# Custom code RAG

While Continue comes with [@Codebase](../deep-dives/codebase.md) out of the box, you might wish to set up your own vector database and build a custom retrieval-augmented generation (RAG) system. This can allow you to access code that is not available locally, to index code a single time across all users, or to include custom logic. In this guide, we'll walk you through the steps it takes to build this.

## Step 1: Choose an embeddings model

If possible, we recommend using [`voyage-code-2`](https://docs.voyageai.com/docs/embeddings), which will give the most accurate answers of any existing embeddings model for code. You can obtain an API key [here](https://dash.voyageai.com/api-keys). Because their API is [OpenAI-compatible](https://docs.voyageai.com/reference/embeddings-api), you can use any OpenAI client by swapping out the URL.

## Step 2: Choose a vector database

There are a number of available vector databases, but because most vector databases will be able to performantly handle large codebases, we would recommend choosing one for ease of setup and experimentation.

[LanceDB](https://lancedb.github.io/lancedb/basic/) is a good choice for this because it can run in-memory with libraries for both Python and Node.js. This means that in the beginning you can focus on writing code rather than setting up infrastructure. If you have already chosen a vector database, then using this instead of LanceDB is also a fine choice.

## Step 3: Choose a "chunking" strategy

Most embeddings models can only handle a limited amount of text at once. To get around this, we "chunk" our code into smaller pieces.

If you use `voyage-code-2`, it has a maximum context length of 16,000 tokens, which is enough to fit most files. This means that in the beginning you can get away with a more naive strategy of truncating files that exceed the limit. In order of easiest to most comprehensive, 3 chunking strategies you can use are:

1. Truncate the file when it goes over the context length: in this case you will always have 1 chunk per file.
2. Split the file into chunks of a fixed length: starting at the top of the file, add lines you your current chunk until it reaches the limit, then start a new chunk.
3. Use a recursive, abstract syntax tree (AST)-based strategy: this is the most exact, but most complex. In most cases you can achieve high quality results by using (1) or (2), but if you'd like to try this you can find a reference example in [our code chunker](https://github.com/continuedev/continue/blob/main/core/indexing/chunk/code.ts) or in [LlamaIndex](https://docs.llamaindex.ai/en/stable/api_reference/node_parsers/code/).

As usual in this guide, we recommend starting with the strategy that gives 80% of the benefit with 20% of the effort.

## Step 4: Put together an indexing script

Indexing, in which we will insert your code into the vector database in a retrievable format, happens in three steps:

1. Chunking
2. Generating embeddings
3. Inserting into the vector database

With LanceDB, we can do steps 2 and 3 simultaneously, as demonstrated [in their docs](https://lancedb.github.io/lancedb/basic/#using-the-embedding-api). If you are using Voyage AI for example, it would be configured like this:

```python
from lancedb.pydantic import LanceModel, Vector
from lancedb.embeddings import get_registry

db = lancedb.connect("/tmp/db")
func = get_registry().get("openai").create(
    name="voyage-code-2",
    base_url="https://api.voyageai.com/v1/",
    api_key=os.environ["VOYAGE_API_KEY"],
)

class CodeChunks(LanceModel):
    filename: str
    text: str = func.SourceField()
    # 1536 is the embedding dimension of the `voyage-code-2` model.
    vector: Vector(1536) = func.VectorField()

table = db.create_table("code_chunks", schema=CodeChunks, mode="overwrite")
table.add([
    {"text": "print('hello world!')", filename: "hello.py"},
    {"text": "print('goodbye world!')", filename: "goodbye.py"}
])

query = "greetings"
actual = table.search(query).limit(1).to_pydantic(CodeChunks)[0]
print(actual.text)
```

:::tip

If you are indexing more than one repository, it is best to store these in separate "tables" (terminology used by LanceDB) or "collections" (terminology used by some other vector DBs). The alternative of adding a "repository" field and then filtering by this is less performant.

:::

Regardless of which database or model you have chosen, your script should iterate over all of the files that you wish to index, chunk them, generate embeddings for each chunk, and then insert all of the chunks into your vector database.

## Step 5: Run your indexing script

:::tip

In a perfect production version, you would want to build "automatic, incremental indexing", so that you whenever a file changes, that file and nothing else is automatically re-indexed. This has the benefits of perfectly up-to-date embeddings and lower cost.

That said, we highly recommend first building and testing the pipeline before attempting this. Unless your codebase is being entirely rewritten frequently, a full refresh of the index is likely to be sufficient and reasonably cheap.
:::

At this point, you've written your indexing script and tested that you can make queries from your vector database. Now, you'll want a plan for when to run the indexing script.

In the beginning, you should probably run it by hand. Once you are confident that your custom RAG is providing value and is ready for the long-term, then you can set up a cron job to run it periodically. Because codebases are largely unchanged in short time frames, you won't want to re-index more than once a day. Once per week or month is probably even sufficient.

## Step 6: Set up your server

In order for the Continue extension to access your custom RAG system, you'll need to set up a server. This server is responsible for recieving a query from the extension, querying the vector database, and returning the results in the format expected by Continue.

Here is a reference implementation using FastAPI that is capable of handling requests from Continue's "http" context provider.

```python
"""
This is an example of a server that can be used with the "http" context provider.
"""

from fastapi import FastAPI
from pydantic import BaseModel


class ContextProviderInput(BaseModel):
    query: str
    fullInput: str


app = FastAPI()


@app.post("/retrieve")
async def create_item(item: ContextProviderInput):
    results = [] # TODO: Query your vector database here.

    # Construct the "context item" format expected by Continue
    context_items = []
    for result in results:
        context_items.append({
            "name": result.filename,
            "description": result.filename,
            "content": result.text,
        })

    return context_items
```

After you've set up your server, you can configure Continue to use it by adding the "http" context provider to your `contextProviders` array in `config.json`:

```json title="config.json"
{
  "name": "http",
  "params": {
    "url": "https://myserver.com/retrieve",
    "title": "http",
    "description": "Custom HTTP Context Provider",
    "displayTitle": "My Custom Context"
  }
}
```

## Step 7 (Bonus): Set up reranking

If you'd like to improve the quality of your results, a great first step is to add reranking. This involves retrieving a larger initial pool of results from the vector database, and then using a reranking model to order them from most to least relevant. This works because the reranking model can perform a slightly more expensive calculation on the small set of top results, and so can give a more accurate ordering than similarity search, which has to search over all entries in the database.

If you wish to return 10 total results for each query for example, then you would:

1. Retrieve ~50 results from the vector database using similarity search
2. Send all of these 50 results to the reranker API along with the query in order to get relevancy scores for each
3. Sort the results by relevancy score and return the top 10

We recommend using the `rerank-2` model from Voyage AI, which has examples of usage [here](https://docs.voyageai.com/docs/reranker).
