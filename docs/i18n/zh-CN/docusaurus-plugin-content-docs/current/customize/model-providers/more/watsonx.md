# IBM watsonx

watsonx, 由 IBM 开发，提供不同的预训练 AI 基础模型，可以用来自然语言处理 (NLP) ，计算机视觉和语音识别任务。

## 设置

为了访问 watsonx 模型，可以通过在 IBM 云的 watsonx SaaS 或者使用专有的 watsonx.ai 软件实例。

### watsonx.ai SaaS - IBM 云

为了开始使用 watsonx SaaS ，访问 [注册页面](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx) 。如果你没有已有的 IBM 云帐号，可以注册免费试用。

为了使用 Continue 认证 watsonx.ai SaaS ，你需要创建一个项目，然后 [设置 API key](https://www.ibm.com/docs/en/mas-cd/continuous-delivery?topic=cli-creating-your-cloud-api-key) 。然后，在 Continue 中：

- 设置 **watsonx URL** 为你的 watsonx SaaS 端点，例如 `https://us-south.ml.cloud.ibm.com` 使用 US 南方区域。
- 设置 **watsonx Project ID** 为你的 watsonx 项目 ID 。
- 设置 **watsonx API Key** 为你的 watsonx API Key 。

### watsonx.ai 软件

为了使用 Continue 认证你的 watsonx.ai 软件实例，你可以使用 `username/password` 或 `ZenApiKey` 方法：

1. _选项 1_ (推荐)： 使用 `ZenApiKey` 认证：
   - 设置 **watsonx URL** 为你的 watsonx 软件端点，例如 `https://cpd-watsonx.apps.example.com` 。
   - 设置 **watsonx Project ID** 为你的 watsonx 项目 ID 。
   - 设置 **watsonx API Key** 为你的 watsonx Zen API Key 。要生成它：
     1. 登录到 CPD 网页客户端。
     2. 在工具栏中，点击头像。
     3. 点击 **简介和设置** 。
     4. 点击 **API key** > **生成新的 key** 。
     5. 点击 **生成** 。
     6. 点击 **复制** 并保存你的 key 到安全的地方。如果丢失，你不能恢复这个 key 。
     7. 生成你的 ZenApiKey ，通过在你喜欢的终端中运行下面的命令： `echo "<username>:<apikey>" | base64` ，替换 `<username>` 为你的 CPD username 和 `<apikey>` 为你刚刚创建的 API key 。
2. _选项 2_: 使用 `username/password` 认证：
   - 设置 **watsonx URL** 为你的 watsonx 软件端点，例如 `https://cpd-watsonx.apps.example.com` 。
   - 设置 **watsonx Project ID** 为你的 watsonx 项目 ID 。
   - 设置 **watsonx API Key** 为你的 watsonx 用户名和密码，使用 `username:password` 格式。

## 配置

添加下面的配置到你的 `config.json` 文件来使用 watsonx 提供者。填写 `watsonxCreds` ，使用你在设置步骤中获取的认证信息。

```json title="~/.continue/config.json"
{
  "models": [
    {
      "model": "model ID",
      "title": "watsonx - Model Name",
      "watsonxUrl": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "watsonxProjectId": "PROJECT_ID",
      "watsonxCreds": "API_KEY/ZENAPI_KEY/USERNAME:PASSWORD",
      "watsonxApiVersion": "2023-05-29",
      "provider": "watsonx"
    }
  ]
}
```

`watsonxAPIVersion` 是可选的，默认为最新版。

### 配置选项

如果你使用一个自定义的端点，添加完整的 watsonx URL 到 `watsonxFullUrl` 。当设置了 `watsonxFullUrl` ， `watsonxUrl` 和 `watsonxApiVersion` 会被忽略。

```json title="~/.continue/config.json"
{
  "models": [
    {
      "model": "model ID",
      "title": "watsonx - Model Name",
      "watsonxUrl": "watsonx endpoint e.g. https://us-south.ml.cloud.ibm.com",
      "watsonxProjectId": "PROJECT_ID",
      "watsonxCreds": "API_KEY",
      "watsonxApiVersion": "2023-05-29",
      "provider": "watsonx",
      "watsonxFullUrl": "https://us-south.ml.cloud.ibm.com/m1/v1/text/generation"
    }
  ]
}
```

## 使用

![usage-gif](../assets/watsonx2.gif)
