## 接入和配置LLM模型

Continue 的强大之处在于其灵活性，允许您接入并配置各种大型语言模型 (LLM)。Continue 支持通过 `config.yaml` (推荐方式) 和 `config.json` (旧有方式) 两种文件格式进行配置。本节将详细介绍这两种方法。

### 使用 `config.yaml` (推荐)

`config.yaml` 是 Continue 当前推荐的配置文件格式，因其可读性更佳，并且能通过配合 `.env` 文件更安全地管理API密钥。

1.  **主要配置文件位置**:
    `config.yaml` 文件可以存在于两个位置：
    *   **全局配置**: `~/.continue/assistants/config.yaml` (Linux/macOS) 或 `%USERPROFILE%\.continue\assistants\config.yaml` (Windows)。此处的配置适用于您所有的项目。
    *   **工作区配置**: `.continue/assistants/config.yaml` (在您的项目根目录下)。此处的配置仅对当前工作区有效，并会覆盖全局配置中同名的模型定义。

2.  **模型定义**:
    在 `config.yaml` 文件中，模型定义在 `models:` 块下。每个模型通常包含以下关键字段：
    *   `name`: 您为该模型在IDE中显示的自定义名称，例如 "My GPT-4o" 或 "Local Llama3"。
    *   `provider`: 指定模型的提供者。常见的值有 `openai`, `ollama`, `anthropic`, `gemini`, `mistral` 等。
    *   `model`: 模型的具体ID，这取决于提供者。例如，对于 `openai`，可能是 `gpt-4o` 或 `gpt-3.5-turbo`；对于 `ollama`，可能是您本地运行的 `llama3` 或 `codellama`；对于 `anthropic`，可能是 `claude-3-opus-20240229`。
    *   `roles` (可选): 您可以为模型指定角色，如 `chat` (聊天), `edit` (编辑代码), `autocomplete` (自动补全)。如果未指定，模型通常可用于所有角色。

3.  **API密钥管理 (`config.yaml` 方式)**:
    许多商业模型需要 API 密钥才能访问。Continue 配合 `config.yaml` 提供了安全的方式来管理这些密钥。

    *   **推荐方法：使用 `.env` 文件和 `secrets` 对象**:
        1.  **创建 `.env` 文件**:
            在您的全局 Continue 目录 (`~/.continue/`) 或项目的工作区根目录下创建一个名为 `.env` 的文件。
        2.  **添加API密钥**:
            在 `.env` 文件中，按以下格式添加您的API密钥：
            ```env
            OPENAI_API_KEY=sk-your_actual_openai_api_key_here
            ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here
            GOOGLE_API_KEY=your_google_api_key_here
            ```
            **重要**: 将 `your_actual_..._key_here` 替换为您的真实API密钥。确保不要将包含真实密钥的 `.env` 文件提交到版本控制系统 (如 Git)。建议将 `.env` 加入到 `.gitignore` 文件中。

        3.  **在 `config.yaml` 中引用密钥**:
            使用 `secrets` 对象来引用 `.env` 文件中定义的密钥。
            ```yaml
            models:
              - name: "GPT-4o (OpenAI)"
                provider: openai
                model: gpt-4o
                apiKey: ${{ secrets.OPENAI_API_KEY }}

              - name: "Claude 3.5 Sonnet"
                provider: anthropic
                model: claude-3-5-sonnet-20240620
                apiKey: ${{ secrets.ANTHROPIC_API_KEY }}
            ```
            对于从 Continue Hub 引入的预定义模型配置，您可能在 `with:` 块中使用类似的方式提供密钥：
            ```yaml
            # Example for a model from Continue Hub that requires an API key
            # - hubModelId: openai/gpt-4
            #   with:
            #     OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
            ```

    *   **备选方法 (不推荐用于敏感密钥)**:
        对于某些特定提供商或自定义设置，API密钥可能需要作为请求头的一部分。例如，在 `requestOptions.headers` 中设置 `Authorization: Bearer YOUR_KEY`。但为了安全起见，强烈建议对敏感密钥使用上述的 `secrets` 方法。

4.  **特定提供商说明 (`config.yaml` 方式)**:
    *   **Ollama**:
        对于在本地运行的 Ollama 模型，通常不需要API密钥。您只需指定 `provider: ollama` 以及您在本地已拉取并运行的 `model` 名称。
        ```yaml
        models:
          - name: "Local Llama3"
            provider: ollama
            model: llama3 # 确保 'llama3' 模型已通过 'ollama pull llama3' 下载并在运行中
            # 对于Ollama，通常不需要 apiKey 字段
        ```
    *   **OpenAI, Anthropic, Gemini, Mistral 等**:
        这些云服务提供商通常都需要 API 密钥。请务必按照上述 `.env` 和 `secrets` 的方法进行配置。

5.  **示例 `config.yaml` 片段**:
    下面是一个简单的 `config.yaml` 示例，展示了如何定义一个 OpenAI 模型（使用 `.env` 文件中的密钥）和一个本地 Ollama 模型：

    ```yaml
    # 位于 ~/.continue/assistants/config.yaml 或 .continue/assistants/config.yaml

    models:
      - name: "GPT-4 Omni"
        provider: openai
        model: gpt-4o
        apiKey: ${{ secrets.OPENAI_API_KEY }} # 引用 .env 文件中的 OPENAI_API_KEY

      - name: "Local CodeLlama (7b)"
        provider: ollama
        model: codellama:7b # 确保此模型在您的Ollama服务中可用
        # Ollama通常不需要apiKey

      - name: "Claude 3.5 Sonnet"
        provider: anthropic
        model: claude-3-5-sonnet-20240620
        apiKey: ${{ secrets.ANTHROPIC_API_KEY }} # 引用 .env 文件中的 ANTHROPIC_API_KEY
    ```
    **请确保您的 `.env` 文件 (例如 `~/.continue/.env`) 包含相应的密钥**:
    ```env
    OPENAI_API_KEY=sk-your_openai_key
    ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
    ```

---

### 使用 `config.json`

虽然 Continue 的官方文档现在通常推荐使用 `config.yaml` 进行配置，但在某些情况下或在旧版本中，您可能会遇到或选择使用 `config.json` 文件来配置LLM模型。

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

6.  **`config.json` 中的其他配置**:
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

---

**总结与迁移建议**

目前，`config.yaml` 是 Continue 推荐的配置方式，因为它提供了更好的可读性和更安全的密钥管理。如果您之前使用的是 `config.json`，并希望迁移到 `config.yaml`，建议查阅 Continue 的官方文档。官方文档通常会提供最新的配置指南、支持的模型列表、提供商详情以及更高级的配置选项（如自定义提示模板、上下文提供者等），并且可能是获取迁移步骤的最佳来源。

通过以上配置方法，您可以灵活地接入和配置各种LLM模型，让 Continue 成为您更强大的编程助手。
