# 概述

Continue 是使用任何 [大语言模型 (LLM)](https://www.youtube.com/watch?v=zjkBMFhNj_g) 编程的最简单的方式。你可以通过不同的模型使用它，商业模型，比如通过 OpenAI API 的 GPT-4 ，开源模型，比如使用 Ollama 运行在你的笔记本上的 CodeLlama ，以及所有中间的东西。

当你第一次安装 Continue 时，你可以免费试用它，通过使用一个代理服务器，安全地使用我们的 API key 调用模型，比如 GPT-4, Gemini Pro, and Phind CodeLlama ，分别通过 OpenAI, Google, 和 Together 。

一旦你准备使用自己的 API key 或者一个不同的模型/提供者，点击左下方 `+` 按钮添加一个新的模型到你的 `config.json` 中。

如果你不确定使用哪个模型或提供者，这是我们目前的经验法则：

- 使用 OpenAI 的 GPT-4 ，如果你想要总体最好的模型
- 通过 Together API 使用 DeepSeek Coder 33B ，如果你想要最好的开源模型
- 通过 Ollama 使用 DeepSeek Coder 6.7B ，如果你想要在本地运行模型

了解更多：

- [选择提供者](select-provider.md)
- [选择模型](select-model.md)
- [配置](configuration.md)
