---
title: 配置 YAML 参考
description: Continue 配置 YAML 文件参考
keywords: [配置, yaml, 定制]
---

# 配置 YAML 参考

<!-- TODO - data section -->

Continue 可以被配置使用 YAML 文件 `config.yaml` ，作为本地配置，放在全局 `.continue` 文件夹 (`~/.continue` 在 Mac 上， `%USERPROFILE%\.continue`)

以下是可以在 `config.yaml` 中设置的每个属性的详情。

:::info
配置 YAML 不是和 `config.json` 一起工作 - 它替换了它。查看 **[迁移指南](/yaml-migration)** 。 `config.yaml` 当前只在 VS Code 预览版有效。
:::

**任何级别的所有属性都是可选的，除非标记为必需的**

## 属性

在 `config.yaml` 配置文件中最高级别的属性是：

- [`name`](#name) (**必需的**)
- [`version`](#version) (**必需的**)
- [`models`](#models)
- [`context`](#context)
- [`rules`](#rules)
- [`prompts`](#prompts)
- [`docs`](#docs)
  <!-- - [`data`](#data) -->
  <!-- - [`tools`](#tools) -->
- [`mcpServers`](#mcpservers)

---

### `name`

`name` 属性指定你的项目或配置的名称。

```yaml title="config.yaml"
name: MyProject
```

### `version`

`version` 属性指定你的项目或配置的版本。

---

### `models`

`models` 小节定义你的配置中使用的语言模型。模型用来实现功能，比如聊天、编辑和总结。

**属性：**

- `name` (**必需的**): 一个唯一的名称，在你的配置中确定模型。
- `provider` (**必需的**): 模型的提供者 (例如，`openai`, `ollama`) 。
- `model` (**必需的**): 指定模型的名称 (例如，`gpt-4`, `starcoder`) 。
- `roles`: 指定这个模型可以实现的角色，例如 `chat`, `autocomplete`, `embed`, `rerank`, `edit`, `apply`, `summarize` 。
- `defaultCompletionOptions`: 模型设置的默认的补全选项。

  **属性：**

  - `contextLength`: 模型的最大上下文长度，通常是 token 。
  - `maxTokens`: 在补全中生成的 token 的最大数量。
  - `temperature`: 控制补全的随机性。值的范围在 `0.0` (确定的) 到 `1.0` (随机的) 。
  - `topP`: 核采样的累计可能性。
  - `topK`: 每一步考虑 token 的最大数量。
  - `stop`: 一个停止补全的 token 的列表。
  - `n`: 生成补全的数量。

- `requestOptions`: 模型特定的 HTTP 请求选项。

  **属性：**

  - `timeout`: 每个请求到 LLM 的超时时间。
  - `verifySsl`: 是否验证请求的 SSL 证书。
  - `caBundlePath`: HTTP 请求定制 CA 证书集的路径。
  - `proxy`: HTTP 请求使用的代理 URL 。
  - `headers`: HTTP 请求的定制头。
  - `extraBodyProperties`: HTTP 请求体合并的额外的属性。
  - `noProxy`: 绕过指定代理的主机名列表。
  - `clientCertificate`: HTTP 请求的客户端证书。
    - `cert`: 客户端证书文件的路径。
    - `key`: 客户端证书 key 文件的路径。
    - `passphrase`: 可选的客户端证书 key 文件的密钥。

  - `timeout`: Timeout for each request to the language model.
  - `verifySsl`: Whether to verify SSL certificates for requests.
  - `caBundlePath`: Path to a custom CA bundle for HTTP requests.
  - `proxy`: Proxy URL for HTTP requests.
  - `headers`: Custom headers for HTTP requests.
  - `extraBodyProperties`: Additional properties to merge with the HTTP request body.
  - `noProxy`: List of hostnames that should bypass the specified proxy.
  - `clientCertificate`: Client certificate for HTTP requests.
    - `cert`: Path to the client certificate file.
    - `key`: Path to the client certificate key file.
    - `passphrase`: Optional passphrase for the client certificate key file.

#### 示例：

```yaml title="config.yaml"
models:
  - name: GPT-4o
    provider: openai
    model: gpt-4o
    roles:
      - chat
      - edit
      - apply
    defaultCompletionOptions:
      temperature: 0.7
      maxTokens: 1500

  - name: Codestral
    provider: mistral
    model: codestral-latest
    roles:
      - autocomplete
```

---

### `context`

`context` 小节定义了上下文提供者，给语言模型提供额外的信息或上下文。每个上下文提供者可以使用特定的参数配置。

更多关于每个上下文提供者 使用/参数 的信息可以 [在这里](/customize/context-providers) 找到。

**属性：**

- `provider` (**必需的**): 上下文提供者的标识符或名称 (例如，`code`, `docs`, `web`) 。
- `params`: 可选的参数来配置上下文的行为。

**示例：**

```yaml title="config.yaml"
context:
  - provider: files
  - provider: code
  - provider: codebase
    params:
      nFinal: 10
  - provider: docs
  - provider: diff
  - provider: folder
  - provider: terminal
```

---

### `rules`

LLM 应该遵守的规则。它们插入到每个聊天请求的系统信息中。

**示例：**

```yaml title="config.yaml"
rules:
  - Always annotate Python functions with their parameter and return types
  - Always write Google style docstrings for functions and classes
```

---

### `prompts`

可以从聊天窗口触发的提示词列表。每个提示词有一个名称、描述和实际的提示词文本。

```yaml title="config.yaml"
prompts:
  - name: check
    description: Check for mistakes in my code
    prompt: |
      Please read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:
        - Syntax errors
        - Logic errors
        - Security vulnerabilities
```

---

### `docs`

需要索引的文档网站的列表。

**Properties:**

- `name` (**必需的**): 文档网站的名称，在下拉框等中显示。
- `startUrl` (**必需的**): 爬取开始的页面 - 通常是文档的根或介绍页面。
<!-- - `rootUrl`: Crawler will only index docs within this domain - pages that contain this URL -->
- `favicon`: 网站 favicon 的 URL (默认是 `startUrl` 的 `/favicon.ico`)。
- `maxDepth`: M
- `useLocalCrawling`: 强制使用本地爬取。

**示例：**

```yaml title="config.yaml"
docs:
  - name: Continue
    startUrl: https://docs.continue.dev/intro
    favicon: https://docs.continue.dev/favicon.ico
```

---

<!-- ### `tools`

The `tools` section specifies external tools or APIs that can be used within your configuration.

**Properties:**

- `url` (**required**): The URL of the tool's API or endpoint.
- `apiKey`: An optional API key required by the tool.

**Example:**

```yaml title="config.yaml"
tools:
  - url: https://api.exampletool.com/tool1
    apiKey: YOUR_API_KEY
```

--- -->

### `mcpServers`

<!-- TODO is this correct? -->

[模型上下文协议](https://modelcontextprotocol.io/introduction) 是一个 Anthropic 的标准建议，用来统一提示词、上下文和工具的使用。 Continue 支持任何有 MCP 上下文提供者的 MCP 服务器。

**属性：**

- `name` (**必需的**): MCP 服务器的名称。
- `command` (**必需的**): 启动服务器的命令。
- `args`: 一个可选的命令的参数列表。
- `env`: 一个可选的服务器进程的环境变量映射。

**示例：**

```yaml title="config.yaml"
mcpServers:
  - name: My MCP Server
    command: uvx
    args:
      - mcp-server-sqlite
      - --db-path
      - /Users/NAME/test.db
```

### `data`

[开发数据](./customize/deep-dives/development-data.md) 将要发送的目标。

**属性：**

- `name` (**必需的**): 数据目标的显示名称
- `destination` (**必需的**): 接收数据的目标/端点。可以是：
  - 一个 HTTP 端点，接收一个带有 JSON blob 的 POST 请求
  - 一个文件 URL 到一个目录，事件会导出到 `.jsonl` 文件中
- `schema` (**必需的**): 要发送的 JSON blobs 的 schema 版本
- `events`: 要包含的事件名称的列表。如果没有指定，默认是所有的事件。
- `level`: 一个预先定义的事件字段过滤器。选项包括 `all` 和 `noCode` ；后者排除数据，比如文件内容，提示词和补全。默认是 `all`
- `apiKey`: 发送请求使用的 api key (Bearer header)
- `requestOptions`: 事件 POST 请求的选项。和 [模型 requestOptions](#models) 一样的格式。.

  **示例：**

```yaml title="config.yaml"
data:
  - name: Local Data Bank
    destination: file:///Users/dallin/Documents/code/continuedev/continue-extras/external-data
    schema: 0.2.0
    level: all
  - name: My Private Company
    destination: https://mycompany.com/ingest
    schema: 0.2.0
    level: noCode
    events:
      - autocomplete
      - chatInteraction
```

---

## 完整的 YAML 配置示例

把它们放在一起，这是一个完整的 `config.yaml` 配置文件示例。

```yaml title="config.yaml"
name: MyProject
version: 0.0.1

models:
  - name: GPT-4
    provider: openai
    model: gpt-4
    roles:
      - chat
      - edit
    defaultCompletionOptions:
      temperature: 0.5
      maxTokens: 2000
    requestOptions:
      headers:
        Authorization: Bearer YOUR_OPENAI_API_KEY

  - name: Ollama Starcoder
    provider: ollama
    model: starcoder
    roles:
      - autocomplete
    defaultCompletionOptions:
      temperature: 0.3
      stop:
        - "\n"

rules:
  - Give concise responses
  - Always assume TypeScript rather than JavaScript

prompts:
  - name: test
    description: Unit test a function
    prompt: |
      Please write a complete suite of unit tests for this function. You should use the Jest testing framework.  The tests should cover all possible edge cases and should be as thorough as possible.  You should also include a description of each test case.

context:
  - provider: diff
  - provider: file
  - provider: codebase
  - provider: code
  - provider: docs
    params:
      startUrl: https://docs.example.com/introduction
      maxDepth: 3

mcpServers:
  - name: DevServer
    command: npm
    args:
      - run
      - dev
    env:
      PORT: "3000"
```
