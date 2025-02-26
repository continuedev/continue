# IBM watsonx

watsonx, 由 IBM 开发，提供不同的预训练 AI 基础模型，可以用来自然语言处理 (NLP) ，计算机视觉和语音识别任务。

## 设置

为了访问 watsonx 模型，可以通过在 IBM 云的 watsonx SaaS 或者使用专有的 watsonx.ai 软件实例。

### watsonx.ai SaaS - IBM 云

为了开始使用 watsonx SaaS ，访问 [注册页面](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx) 。如果你没有已有的 IBM 云帐号，可以注册免费试用。

为了使用 Continue 认证 watsonx.ai SaaS ，你需要创建一个项目，然后 [设置 API key](https://www.ibm.com/docs/en/mas-cd/continuous-delivery?topic=cli-creating-your-cloud-api-key) 。然后，在 Continue 中：

- 设置 **apiBase** 为你的 watsonx SaaS 端点，例如 `https://us-south.ml.cloud.ibm.com` 使用 US 南方区域。
- 设置 **projectId** 为你的 watsonx 项目 ID 。
- 设置 **apiKey** 为你的 watsonx API Key 。

### watsonx.ai 软件

为了使用 Continue 认证你的 watsonx.ai 软件实例，你可以使用 `username/password` 或 `ZenApiKey` 方法：

1. _选项 1_ (推荐)： 使用 `ZenApiKey` 认证：
   - 设置 **apiBase** 为你的 watsonx 软件端点，例如 `https://cpd-watsonx.apps.example.com` 。
   - 设置 **projectId** 为你的 watsonx 项目 ID 。
   - 设置 **apiKey** 为你的 watsonx Zen API Key 。要生成它：
     1. 登录到 CPD 网页客户端。
     2. 在工具栏中，点击头像。
     3. 点击 **简介和设置** 。
     4. 点击 **API key** > **生成新的 key** 。
     5. 点击 **生成** 。
     6. 点击 **复制** 并保存你的 key 到安全的地方。如果丢失，你不能恢复这个 key 。
     7. 生成你的 ZenApiKey ，通过在你喜欢的终端中运行下面的命令： `echo "<username>:<apikey>" | base64` ，替换 `<username>` 为你的 CPD username 和 `<apikey>` 为你刚刚创建的 API key 。
2. _选项 2_: 使用 `username/password` 认证：
   - 设置 **apiBase** 为你的 watsonx 软件端点，例如 `https://cpd-watsonx.apps.example.com` 。
   - 设置 **projectId** 为你的 watsonx 项目 ID 。
   - 设置 **apiKey** 为你的 watsonx 用户名和密码，使用 `username:password` 格式。

## 配置

添加下面的配置到你的 `config.json` 文件来使用 watsonx 提供者。

```json title="~/.continue/config.json"
{
  "models": [
    {
      "model": "model ID",
      "title": "watsonx - Model Name",
      "provider": "watsonx",
      "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "projectId": "PROJECT_ID",
      "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "apiVersion": "2024-03-14"
    }
  ]
}
```

`apiVersion` 是可选的，默认为最新版。

如果你使用一个自定义的部署端点，设置 `deploymentID` 到模型的部署 ID 。你可以在 watsonx.ai Prompt Lab UI 中找到它，通过选择对应的模型，在右边打开 `</>` 标签，将会显示包含部署 ID 的端点 URL 。

```json title="~/.continue/config.json"
{
  "models": [
    {
      "model": "model ID",
      "title": "watsonx - Model Name",
      "provider": "watsonx",
      "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "apiVersion": "2024-03-14",
      "deploymentId": "DEPLOYMENT_ID"
    }
  ]
}
```

### 配置选项

确保指定一个模板名称，比如 `granite` 或 `llama3` ，并设置 `contextLength` 为模型上下文窗口大小。
你也可以配置生成参数，比如 temperature, topP, topK, frequency penalty, 和 stop sequences ：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "model": "ibm/granite-20b-code-instruct",
      "title": "Granite Code 20b",
      "provider": "watsonx",
      "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "projectId": "PROJECT_ID",
      "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "apiVersion": "2024-03-14",
      "template": "granite",
      "contextLength": 8000,
      "completionOptions": {
        "temperature": 0.1,
        "topP": 0.3,
        "topK": 20,
        "maxTokens": 2000,
        "frequencyPenalty": 1.1,
        "stop": [
          "Question:",
          "\n\n\n"
        ]
      }
    }
  ]
}
```

## Tab 自动补全模型

Granite 模型推荐为 tab 自动补全。配置类似于聊天模型：
```json title="~/.continue/config.json"
{
    "tabAutocompleteModel": {
      "model": "ibm/granite-8b-code-instruct",
      "title": "Granite Code 8b",
      "provider": "watsonx",
      "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "projectId": "PROJECT_ID",
      "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "apiVersion": "2024-03-14",
      "contextLength": 4000
    }
}
```

## 嵌入模型

为了查看可用的嵌入模型列表，访问 [这个页面](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models-embed.html?context=wx&pos=2#ibm-provided) 。
```json title="~/.continue/config.json
{
  "embeddingsProvider": {
    "provider": "watsonx",
    "model": "ibm/slate-30m-english-rtrvr-v2",
    "apiBase": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
    "projectId": "PROJECT_ID",
    "apiKey": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
    "apiVersion": "2024-03-14"
  }
}
```
