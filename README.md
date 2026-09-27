# dLLM Line Edit

VS Code next-edit predictions using your own diffusion language model API key.

## Configure a model

Create or update `~/.continue/config.yaml`:

```yaml
name: dLLM Line Edit
version: 0.1.0
schema: v1
models:
  - name: Mercury Coder
    provider: openrouter
    model: inception/mercury-coder
    apiBase: https://openrouter.ai/api/v1
    apiKey: ${{ secrets.OPENROUTER_API_KEY }}
    roles:
      - autocomplete
    capabilities:
      - next_edit
```

Use the `openai` provider with the API base URL for any OpenAI-compatible provider. Set `capabilities: [next_edit]` for models that return the complete revised editable region. Enable **dLLM Line Edit: Enable Next Edit** in VS Code, then reload the window after changing the configuration.

## License

Apache 2.0. See [LICENSE](LICENSE).
