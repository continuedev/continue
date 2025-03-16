---
title: config.json 参考
description: Continue _config.json_ 配置文件参考
keywords: [配置, config_schema.json, json]
---

:::info
`config.json` 是最初的 Continue 配置格式。更新和更推荐的格式是 [`YAML 配置`](./reference) 。查看 [迁移指南](./yaml-migration) 。
:::

以下是可以在 `config.json` 中设置的每个属性的细节。配置 schema 代码可以在 [`extensions/vscode/config_schema.json`](https://github.com/continuedev/continue/blob/main/extensions/vscode/config_schema.json) 找到。

**任何级别的所有属性都是可选的，除非标记为必需的**

### `models`

你的 **聊天** 模型在这里定义，用来 [聊天](./chat/how-to-use-it.md) ， [编辑](./edit/how-to-use-it.md) 和 [Actions](./actions/how-to-use-it.md) 。
每个模型有特定的配置选项，专门给它的提供者和功能，当编辑 json 时可以看到建议。

**属性：**

- `title` (**必需的**): 你的模型使用的标题，在下拉框等显示
- `provider` (**必需的**): 模型的提供者，决定类型和交互方法。可选项是 `openai`, `ollama`, `xAI` 等。查看 IntelliJ 建议。
- `model` (**必需的**): 模型的名称，用来提示词模板自动检测。使用 `AUTODETECT` 指定名称获取所有可用的模型。
- `apiKey`: 提供者需要的 API key ，比如 OpenAI, Anthropic, Cohere 和 xAI 。
- `apiBase`: LLM API 的基础 URL 。
- `contextLength`: 模型的最大上下文长度，通常是 token （默认值： 2048）
- `maxStopWords`: 停止文字允许的最大长度，避免大量列表的 API 错误。
- `template`: 用来格式化消息的聊天模板。对于大多数模型自动探测，但是可以被覆盖。查看 intelliJ 建议。
- `promptTemplates`: 一个提示词模板名称（比如 `edit`）到模板字符串的映射。[定制指导](https://docs.continue.dev/model-setup/configuration#customizing-the-edit-prompt) 。
- `completionOptions`: 模型特定的补全选项，和最高级的 [`completionOptions`](#completionoptions) 一样的格式，它们会覆盖。
- `systemMessage`: 一个系统消息在 LLM 响应之前。
- `requestOptions`: Model-specific HTTP request options, same format as top-level [`requestOptions`](#requestoptions), which they override.
- `requestOptions`: 模型特定的 HTTP 请求选项，与最高级的 [`requestOptions`](#requestoptions) 一样的格式，他们会覆盖。
- `apiType`: 指定 API (`openai` 或 `azure`) 的类型。
- `apiVersion`: Azure API 版本 (例如 `2023-07-01-preview`) 。
- `engine`: Azure OpenAI 请求的引擎。
- `capabilities`: 覆盖自动检测能力：
  - `uploadImage`: 布尔型，表示模型是否支持图片上传。

_(仅 AWS)_

- `profile`: AWS 认证安全配置文件。
- `modelArn`: 导入模型（例如，对于 `bedrockimport` 提供者）的 AWS ARN 。
- `region`: 模型托管的区域（例如，`us-east-1`, `eu-central-1`） 。

示例：

```json title="config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "AUTODETECT"
    },
    {
      "model": "gpt-4o",
      "contextLength": 128000,
      "title": "GPT-4o",
      "provider": "openai",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

### `tabAutocompleteModel`

指定 tab 自动补全的模型或模型们，模式是一个 Ollama 实例。这个属性使用 `models` 一样的格式。可以是一个模型列表或一个模型对象。

示例：

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "My Starcoder",
    "provider": "ollama",
    "model": "starcoder2:3b"
  }
}
```

### `tabAutocompleteOptions`

指定 tab 自动补全行为的选项。

**属性：**

- `disable`: 如果是 `true` ，禁用 tab 自动补全（默认值： `false`） 。
- `maxPromptTokens`: 提示词 token 的最大长度（默认值： `1024`） 。
- `debounceDelay`: 触发自动补全前的延迟（毫秒）（默认值： `350`）。
- `maxSuffixPercentage`: 提示词后缀的最大百分比（默认值： `0.2`）。
- `prefixPercentage`: 前缀的输入百分比（默认值： `0.3`）。
- `template`: 自动补全的模板字符串，使用 Mustache 模板。你可以使用 `{{{ prefix }}}`, `{{{ suffix }}}`, `{{{ filename }}}`, `{{{ reponame }}}` 和 `{{{ language }}}` 变量。
- `onlyMyCode`: 如果是 `true` ，只包含仓库中的代码（默认值： `true`）。

示例：

```json title="config.json"
{
  "tabAutocompleteOptions": {
    "debounceDelay": 500,
    "maxPromptTokens": 1500,
    "disableInFiles": ["*.md"]
  }
}
```

### `embeddingsProvider`

嵌入模型设置 - `@Codebase` 和 `@docs` 使用的模型。

**属性：**

- `provider` (**必需的**): 指定嵌入模型，可选项是 `transformers.js`, `ollama`, `openai`, `cohere`, `gemini` 等。
- `model`: 嵌入的模型名称。
- `apiKey`: 提供者的 API key 。
- `apiBase`: API 请求的基础 URL 。
- `requestOptions`: 特定嵌入提供者额外的 HTTP 请求设置。
- `maxEmbeddingChunkSize`: 每个文档分块的最大 token 。最小值是 128 token 。
- `maxEmbeddingBatchSize`: 每个请求分块的最大数量。最小值是 1 个分块。

(仅 AWS)

- `region`: 指定托管模型的区域。
- `profile`: AWS 安全配置文件。

示例：

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiKey": "<API_KEY>",
    "maxEmbeddingChunkSize": 256,
    "maxEmbeddingBatchSize": 5
  }
}
```

### `completionOptions`

控制文本生成和补全设置行为的参数。最高级别的 `completionOptions` 应用到所有模型， _除非在模型级别被覆盖_ 。

**属性：**

- `stream`: 是否流式输出 LLM 响应。当前只对 `anthropic` 和 `ollama` 提供者有效；其他提供者总是流式地（默认值： `true`）。
- `temperature`: 控制补全的随机性。较高的值导致更多样的输出。
- `topP`: 核采样的累计可能性。较低的值限制 token 的响应在 top 可能性之中。
- `topK`: 每一步考虑 token 的最大数量。这个可能性限制 token 的生成文本。
- `presencePenalty`: 阻止模型生成已经出现在输出的 token 。
- `frequencePenalty`: 基于在文本中的频率处罚 token ，减少重复。
- `mirostat`: 允许 Mirostat 采样，在文本生成时控制复杂性。支持 Ollama, LM Studio 和 llama.cpp 提供者（默认值： `0` ，其中 `0` = disabled, `1` = Mirostat, `2` = Mirostat 2.0 ）。
- `stop`: 一个停止 token 的列表，当出现时，将结束补全。允许指定多个结束条件。
- `maxTokens`: 在一次补全中生成 token 的最大数量（默认值： `2048`）。
- `numThreads`: 生成进程使用的线程数量。只对 Ollama 有效， `num_thread` 。
- `keepAlive`: 对于 Ollama ，这个参数设置最近一次请求之后保持模型加载的秒数，如果不活跃，从内存中卸载它（默认值： `1800` 秒，或 30 分钟）。
- `useMmap`: 对于 Ollama ，这个参数允许模型映射到内存。如果禁用，可以在低端设备上增强响应时间，但是会减慢流式输出。

示例：

```json title="config.json"
{
  "completionOptions": {
    "stream": false,
    "temperature": 0.5
  }
}
```

### `requestOptions`

默认的 HTTP 请求选项，应用到所有模型和上下文提供中，除非在模型级别覆盖。

**属性：**

- `timeout`: 每个请求到 LLM 的超时时间（默认值： `7200` 秒）。
- `verifySsl`: 是否验证请求的 SSL 证书。
- `caBundlePath`: HTTP 请求定制 CA 证书集的路径 - `.pem` 文件的路径（或路径列表）
- `proxy`: HTTP 请求使用的代理 URL 。
- `headers`: HTTP 请求的定制头。
- `extraBodyProperties`: HTTP 请求体合并的额外的属性。
- `noProxy`: 绕过指定代理的主机名列表。
- `clientCertificate`: HTTP 请求的客户端证书。

  - `cert`: 客户端证书文件的路径。
  - `key`: 客户端证书 key 文件的路径。
  - `passphrase`: 可选的客户端证书 key 文件的密钥。

示例：

```json title="config.json"
{
  "requestOptions": {
    "headers": {
      "X-Auth-Token": "xxx"
    }
  }
}
```

### `reranker`

配置在响应排序中使用的排序器模型。

**属性：**

- `name` (**必需的**): 排序器名称，例如 `cohere`, `voyage`, `llm`, `huggingface-tei`, `bedrock`
- `params`:
  - `model`: 模型名称
  - `apiKey`: Api key
  - `region`: 区域（仅 Bedrock）

示例：

```json title="config.json"
{
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-2",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```

### `docs`

索引的文档列表。

**属性：**

- `title` (**必需的**): 文档网站的名称，在下拉框等中显示。
- `startUrl` (**必需的**): 爬取的开始页面 - 通常是文档的根或简介页面
<!-- - `rootUrl`: Crawler will only index docs within this domain - pages that contain this URL -->
- `maxDepth`: 爬取的最大链接深度。默认是 `4`
- `favicon`: 网站 favicon 的 URL （默认是 `startUrl` 的 `/favicon.ico` ）。
- `useLocalCrawling`: 跳过默认爬取器，只使用本地爬取器爬取。

示例：

```json title="config.json"
"docs": [
    {
    "title": "Continue",
    "startUrl": "https://docs.continue.dev/intro",
    "faviconUrl": "https://docs.continue.dev/favicon.ico",
  }
]
```

### `slashCommands`

定制命令在侧边栏中通过输入 "/" 发起。命令包括预定义的功能或用户定义的。

**属性：**

- `name`: 命令的名称。可选项包括 "issue", "share", "cmd", "http", "commit" 和 "review" 。
- `description`: 命令的简短描述。
- `step`: (废弃) 用于内建命令；设置预配置选项的名称。
- `params`: 配置命令行为的额外参数（命令特定的 - 查看命令的代码）

示例：

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "commit",
      "description": "Generate a commit message"
    },
    {
      "name": "share",
      "description": "Export this session as markdown"
    },
    {
      "name": "cmd",
      "description": "Generate a shell command"
    }
  ]
}
```

### `customCommands`

用户定义的在侧边栏中提示词快捷方式的命令，允许快速访问常见的 action 。

**属性：**

- `name`: 定制命令的名称。
- `prompt`: 命令的文本提示词。
- `description`: 解释命令功能的简短描述。

示例：

```json title="config.json"
{
  "customCommands": [
    {
      "name": "test",
      "prompt": "Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ]
}
```

### `contextProviders`

预定义上下文提供者的列表，当在聊天中输入时，显示为可选项，它们使用 `params` 定制。

**属性：**

- `name`: 上下文提供者的名称，例如 `docs` 或 `web`
- `params`: 一个上下文提供者特定的参数记录，用来配置上下文的行为

示例：

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "code",
      "params": {}
    },
    {
      "name": "docs",
      "params": {}
    },
    {
      "name": "diff",
      "params": {}
    },
    {
      "name": "open",
      "params": {}
    }
  ]
}
```

### `disableSessionTitles`

当设置为 `true` 时，禁止生成每个聊天会话的总结标题。

### `ui`

定制 UI 设置来控制接口的生成和行为。

**属性：**

- `codeBlockToolbarPosition`: 设置工具栏在代码块中的位置，`top` (默认) 或 `bottom` 。
- `fontSize`: 指定 UI 元素中的字体大小。
- `displayRawMarkdown`: 如果是 `true` ，在响应中显示原始 markdown 。
- `showChatScrollbar`: 如果是 `true` ，在聊天窗口中启用一个滚动条。
- `codeWrap`: 如果是 `true` ，在代码块中启用文本换行。

示例：

```json title="config.json"
{
  "ui": {
    "codeBlockToolbarPosition": "bottom",
    "fontSize": 14,
    "displayRawMarkdown": false,
    "showChatScrollbar": false,
    "codeWrap": false
  }
}
```

### `allowAnonymousTelemetry`

如果是 `true` ，匿名使用数据被使用 Posthog 收集，以增强功能。默认是 `true` 。

### `userToken`

一个可选的确定用户的 token ，主要用于认证服务。

### `systemMessage`

定义一个系统消息，出现在每个语言模型的响应之前，提供指导或上下文。

### `experimental`

多个试验性的配置参数可用，如下所示：

`experimental`:

- `defaultContext`: 定义 LLM 的默认上下文。使用 `contextProviders` 一样的格式，但是包含额外的 `query` 属性，指定定制查询参数。
- `modelRoles`:
  - `inlineEdit`: 行内编辑的模型标题。
  - `applyCodeBlock`: 应用代码块的模型标题。
  - `repoMapFileSelection`: 仓库映射选择的模型标题。
- `quickActions`: 定制快速 action 的列表
  - `title` (**必需的**): 显示快速 action 的显示名称。
  - `prompt` (**必需的**): 快速 action 的提示词。
  - `sendToChat`: 如果是 `true` ，发送结果到聊天；否则插入到文档中。默认是 `false` 。
- `contextMenuPrompts`:
  - `comment`: 注释代码的提示词。
  - `docstring`: 添加 docstring 的提示词。
  - `fix`: 修复代码的提示词。
  - `optimize`: 优化代码的提示词。
- `modelContextProtocolServers`: 查看 [模型上下文协议](/customize/context-providers#模型上下文协议)

示例：

```json title="config.json"
{
  "experimental": {
    "modelRoles": {
      "inlineEdit": "Edit Model"
    },
    "quickActions": [
      {
        "title": "Tags",
        "prompt": "Return a list of any function and class names from the included code block",
        "sendToChat": true
      }
    ],
    "contextMenuPrompts": {
      "fixGrammar": "Fix grammar in the above but allow for typos."
    },
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "uvx",
          "args": ["mcp-server-sqlite", "--db-path", "/Users/NAME/test.db"]
        }
      }
    ]
  }
}
```
