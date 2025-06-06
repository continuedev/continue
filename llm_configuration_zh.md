## 接入和配置LLM模型

Continue 的强大之处在于其灵活性，允许您接入并配置各种大型语言模型 (LLM)。本节将介绍如何配置这些模型。

1.  **主要配置文件**:
    Continue 主要通过 `config.yaml` 文件来配置模型。这个文件可以存在于两个位置：
    *   **全局配置**: `~/.continue/assistants/config.yaml` (Linux/macOS) 或 `%USERPROFILE%\.continue\assistants\config.yaml` (Windows)。此处的配置适用于您所有的项目。
    *   **工作区配置**: `.continue/assistants/config.yaml` (在您的项目根目录下)。此处的配置仅对当前工作区有效，并会覆盖全局配置中同名的模型定义。

2.  **模型定义**:
    在 `config.yaml` 文件中，模型定义在 `models:` 块下。每个模型通常包含以下关键字段：
    *   `name`: 您为该模型在IDE中显示的自定义名称，例如 "My GPT-4o" 或 "Local Llama3"。
    *   `provider`: 指定模型的提供者。常见的值有 `openai`, `ollama`, `anthropic`, `gemini`, `mistral` 等。
    *   `model`: 模型的具体ID，这取决于提供者。例如，对于 `openai`，可能是 `gpt-4o` 或 `gpt-3.5-turbo`；对于 `ollama`，可能是您本地运行的 `llama3` 或 `codellama`；对于 `anthropic`，可能是 `claude-3-opus-20240229`。
    *   `roles` (可选): 您可以为模型指定角色，如 `chat` (聊天), `edit` (编辑代码), `autocomplete` (自动补全)。如果未指定，模型通常可用于所有角色。

3.  **API密钥管理**:
    许多商业模型（如 OpenAI, Anthropic, Gemini, Mistral 等）需要 API 密钥才能访问。Continue 提供了安全的方式来管理这些密钥。

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

4.  **特定提供商说明**:
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

6.  **参考官方文档**:
    AI模型和提供商的世界在不断发展。为了获取最新支持的模型列表、提供商详情以及更高级的配置选项（如自定义提示模板、上下文提供者等），强烈建议您查阅 **Continue的官方文档**。官方文档是获取最准确和最新信息的最佳来源。

通过以上步骤，您可以灵活地接入和配置各种LLM模型，让 Continue 成为您更强大的编程助手。
