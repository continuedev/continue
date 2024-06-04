# IPEX-LLM

:::info
[**IPEX-LLM**](https://github.com/intel-analytics/ipex-llm) is a PyTorch library for running LLM on Intel CPU and GPU (e.g., local PC with iGPU, discrete GPU such as Arc A-Series, Flex and Max) with very low latency.
:::

IPEX-LLM supports accelerated Ollama backend to be hosted on Intel GPU. Refer to [this guide](https://ipex-llm.readthedocs.io/en/latest/doc/LLM/Quickstart/ollama_quickstart.html) from IPEX-LLM official documentation about how to install and run Ollama serve accelerated by IPEX-LLM on Intel GPU. You can then configure Continue to use the IPEX-LLM accelerated `"ollama"` provider as follows:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "IPEX-LLM",
      "provider": "ollama",
      "model": "AUTODETECT"
    }
  ]
}
```

If you would like to reach the Ollama service from another machine, make sure you set or export the environment variable `OLLAMA_HOST=0.0.0.0` before executing the command `ollama serve`. Then, in the Continue configuration, set `'apiBase'` to correspond with the IP address / port of the remote machine. That is, Continue can be configured to be:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "IPEX-LLM",
      "provider": "ollama",
      "model": "AUTODETECT",
      "apiBase": "http://your-ollama-service-ip:11434"
    }
  ]
}
```

:::tip
- For more configuration options regarding completion or authentication, you could refer to [here](./ollama.md#completion-options) for Ollama provider.
- If you would like to preload the model before your first conversation with that model in Continue, you could refer to [here](https://ipex-llm.readthedocs.io/en/latest/doc/LLM/Quickstart/continue_quickstart.html#pull-and-prepare-the-model) for more information.
:::
