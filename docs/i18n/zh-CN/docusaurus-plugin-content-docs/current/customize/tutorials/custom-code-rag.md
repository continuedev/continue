# 定制代码 RAG

虽然 Continue 的 [@Codebase](../deep-dives/codebase.md) 开箱即用，你可能想要设置自己的向量数据库，并构建一个定制的检索增强生成（RAG）系统。这允许你访问不在本地可用的代码，对每个用户每次索引代码，或者包含定制的逻辑。在这个指南中，我们将展示构建这个的步骤。

## 步骤 1 ：选择嵌入模型

如果可能，我们推荐使用 [`voyage-code-2`](https://docs.voyageai.com/docs/embeddings) ，它将给出最准确的答案，关于任何已存的代码嵌入模型。你可以在 [这里](https://dash.voyageai.com/api-keys) 获取 API key 。因为他门的 API 是 [OpenAI-兼容的](https://docs.voyageai.com/reference/embeddings-api) ，你可以使用任何 OpenAI 客户端换出 URL 。

## 步骤 2 ：选择向量模型

这里有一些可用的向量数据库，但是因为大多数向量数据库能够良好地处理大的代码库，我们推荐选择设置和实验简单的一个。

[LanceDB](https://lancedb.github.io/lancedb/basic/) 是一个很好的选择，因为它可以在内存中运行，有 Python 和 Node.js 库。这意味着，在开始的时候，你可以专注于编写代码，而不是设置基础设施。如果你已经选择了向量数据库，那么使用这个代替 LanceDB 也是一个好的选择。

## 步骤 3 ：选择一个 "分块" 策略

大多数嵌入模型只能一次处理有限的文本数量。为了解决这个问题，我们 "分块" 我们的代码到较小的部分。

如果你使用 `voyage-code-2` ，它可以有最大 16,000 token 上下文长度，足够容纳大多数文件。这意味着，在开始的时候，你可以使用更朴素的策略避免超过限制。为了最简单到最综合，你可以使用 3 分块策略：

1. 截断文件，当它超过上下文长度：在这种情况下，你总是每个文件有 1 个分块。
2. 拆分文件到一个固定长度的分块：从文件的最上面开始，添加你当前分块的行，直到它到达限制，然后开始一个新的分块。
3. 使用一个递归的，基于抽象语法树（AST）的策略：这是最准确的，但是最复杂的。在大多数情况下，通过使用 (1) 或 (2) ，你可以获得好的质量结果，但是如果你想要尝试这个，你可以查找一个参考示例，在 [我们的代码 chunker](https://github.com/continuedev/continue/blob/main/core/indexing/chunk/code.ts) 或在 [LlamaIndex](https://docs.llamaindex.ai/en/stable/api_reference/node_parsers/code/) 。

像往常一样，在这个指南中，我们推荐开始的策略，使用 20% 的努力获得 80% 的收益。

## 步骤 4 ：放在一起一个索引脚本

Indexing, in which we will insert your code into the vector database in a retrievable format, happens in three steps:

索引，我们将以可检索的格式插入你的代码到向量数据库，有以下三个步骤：

1. 分块
2. 生成嵌入
3. 插入到向量数据库

使用 LanceDB ，我们可以同时做步骤 2 和 3 ，像 [他门的文档](https://lancedb.github.io/lancedb/basic/#using-the-embedding-api) 所描述的。如果你使用 Voyage AI ，它可以配置像下面这样：

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
如果你索引超过一个仓库，最好保存它们到不同的 "table" （LanceDB 使用的术语）或 "collection" （一些其他向量数据库使用的术语）。可替代的做法，添加一个 "repository" 字段，然后通过这个过滤是性能较低的。
:::

不管你选择的是哪个数据库或模型，你的脚本应该迭代你想要索引的所有文件，对它们分块，生成每个分块的嵌入，然后插入所有分块到你的向量数据库。

## 步骤 5 ：运行你的索引脚本

:::tip
在一个完成的生产版本，你想要构建 "自动的，增量的索引" ，以便无论任何时候文件变更，那个文件没有别的自动重新索引。这有完全最新嵌入的收益和较低的花费。

也就是说，我们强烈推荐，在尝试这个之前，首先构建和测试流水线。除非你的代码库频繁地整个重写，一个完整的索引刷新，是足够的和合理的便宜。
:::

在这个点上，你编写了你的索引脚本，测试可以从你的向量数据库做查询。现在，你想要什么时候运行索引脚本的计划。

在开始的时候，你可能手动运行它。一旦你确认，你定制的 RAG 提供了值，准备好长期使用，那么你可以设置一个 cron 任务，定期地运行它。因为代码库在短的时间内不会大量变更，你不会想要重新索引超过一天一次。每周一次或每月一次甚至可能是足够的。

## 步骤 6 ：设置你的服务器

为了 Continue 扩展能够访问你的定制 RAG 系统，你需要设置服务器。这个服务器负责接收来自扩展的查询，查询向量数据库，返回 Continue 想要的格式的结果。

这是一个使用 FastAPI 的参考实现，适用于处理来自 Continue 的 "http" 上下文提供者的请求。

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

在你设置服务器之后，你可以配置 Continue 使用它，通过添加 "http" 上下文提供者到你的 `config.json` 中的 `contextProviders` 列表：

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

## 步骤 7 （额外的）：设置重排序

如果你想要提高你的结果的质量，一个好的首先的步骤是添加重排序。这涉及到获取一个更大的来自向量数据库的初始结果池，然后使用重排序模型对它们进行排序，从最高到最低相关性。这是有效的，因为重排序模型可以执行一个稍高的计算，在一个小的最高结果上，所以可以给出比相似性搜索更准确的排序，它需要搜索数据库中所有的条目。

例如，如果你想要对于每个查询返回 10 个完整的结果，那么你可以：

1. 使用相似性搜索从向量数据库检索 ~50 个结果
2. 发送所有这 50 个结果到重排器 API ，与查询一起，为了获取每个结果的相关性分数
3. 通过相关性分数对结果进行排序，并返回最前面 10 个

我们推荐使用来自 Voyage AI 的 `rerank-1` 模型，它有使用示例 [在这里](https://docs.voyageai.com/docs/reranker) 。
