### 通过 `config.json` 配置模型 (备选方法)

虽然 Continue 的官方文档现在通常推荐使用 `config.yaml` 进行配置，但在某些情况下或在旧版本中，您可能会遇到或选择使用 `config.json` 文件来配置LLM模型。本节简要介绍如何使用 `config.json`。

1.  **文件位置**:
    `config.json` 文件通常位于以下位置之一：
    *   **全局配置**: `~/.continue/config.json` (Linux/macOS) 或 `%USERPROFILE%\.continue\config.json` (Windows)。
    *   **工作区配置**: `.continue/config.json` (在您的项目根目录下)。此处的配置会覆盖全局配置。

2.  **文件结构**:
    `config.json` 是一个标准的JSON文件。模型定义通常在一个名为 `"models"` 的顶层数组中。

3.  **`config.json` 中的关键模型属性**:
    在 `"models"` 数组中，每个模型对象通常包含以下属性：
    *   `"title"` (字符串): 在IDE中为该模型显示的名称。
    *   `"provider"` (字符串): LLM的提供商，例如 `"openai"`, `"ollama"`, `"anthropic"`, `"gemini"`。
    *   `"model"` (字符串): 具体的模型ID，例如 `"gpt-4o"`, `"claude-3-opus-20240229"`。对于 Ollama，您可以使用 `"AUTODETECT"` 来自动检测可用的本地模型，或者指定具体的模型名称如 `"llama3"`。
    *   `"apiKey"` (字符串, 可选): 访问模型所需的API密钥。
    *   `"apiBase"` (字符串, 可选): 对于需要自定义API端点的提供商（例如自托管的Ollama或兼容OpenAI API的服务），可以使用此字段指定基础URL。

4.  **`config.json` 中的API密钥处理**:
    *   在 `config.json` 中，API密钥通常以**直接字符串**的形式包含在模型定义的 `"apiKey"` 字段中。
    *   **安全提示**: 如果您的 `config.json` 文件包含敏感的API密钥，请务必妥善保护此文件，避免意外泄露（例如，不要将其提交到公共代码仓库）。虽然某些工具可能支持在JSON字符串中引用环境变量 (例如 `"$MY_API_KEY"`), 但在Continue的 `config.json` 中，直接写入密钥是文档中常见的方式。相比之下，`config.yaml` 配合 `.env` 文件和 `secrets` 对象提供了更安全的密钥管理机制。

5.  **示例 `config.json` 片段**:
    以下是如何在 `config.json` 中定义一个OpenAI模型和一个Ollama模型的示例：

    ```json
    {
      "models": [
        {
          "title": "GPT-4o (OpenAI - JSON)",
          "provider": "openai",
          "model": "gpt-4o",
          "apiKey": "sk-YOUR_OPENAI_API_KEY_HERE"
        },
        {
          "title": "Local Llama3 (Ollama - JSON)",
          "provider": "ollama",
          "model": "llama3"
        },
        {
          "title": "Ollama Autodetect (JSON)",
          "provider": "ollama",
          "model": "AUTODETECT"
        }
      ]
    }
    ```
    请记得将 `"sk-YOUR_OPENAI_API_KEY_HERE"` 替换为您的真实OpenAI API密钥。

6.  **其他配置**:
    除了 `"models"` 数组外，`config.json` 还可能包含其他顶层键，用于配置特定功能，例如：
    *   `"tabAutocompleteModel"`: 用于配置Tab键自动补全功能的特定模型。
    *   `"embeddingsProvider"`: 用于配置生成嵌入（embeddings）的模型。

    示例：
    ```json
    {
      "models": [
        // ... 您的模型定义 ...
      ],
      "tabAutocompleteModel": {
        "provider": "ollama",
        "model": "codellama:7b-instruct"
      },
      "embeddingsProvider": {
        "provider": "openai",
        "model": "text-embedding-ada-002"
      }
      // ... 其他配置 ...
    }
    ```

虽然 `config.json` 提供了配置Continue的一种方式，但鉴于 `config.yaml` 在密钥管理和可读性方面的优势，建议优先考虑使用 `config.yaml`。如果您的项目或全局配置中同时存在 `config.json` 和 `config.yaml`，Continue 的行为可能会优先选择其中一个（通常是 `config.yaml`），具体请参考最新的官方文档。
