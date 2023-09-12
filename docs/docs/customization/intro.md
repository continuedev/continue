# Customizing Continue

Continue can be deeply customized by editing the `ContinueConfig` object in `~/.continue/config.py` (`%userprofile%\.continue\config.py` for Windows) on your machine. This file is created the first time you run Continue.

Currently, you can customize the following:

- [Models](./models.md) - Use Continue with any LLM, including local models, Azure OpenAI service, and any OpenAI-compatible API.
- [Context Providers](./context-providers.md) - Define which sources you want to collect context from to share with the LLM. Just type '@' to easily add attachments to your prompt.
- [Slash Commands](./slash-commands.md) - Call custom prompts or programs written with our SDK by typing `/` in the prompt.
- [Other Configuration](./other-configuration.md) - Configure other settings like the system message, temperature, and more.
