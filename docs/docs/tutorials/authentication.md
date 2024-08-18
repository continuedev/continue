---
title: Configuring Authentication
description: Learn how to configure authentication for various LLM providers in Continue, including API keys, custom headers, and client certificates.
keywords: [authentication, API key, custom headers, client certificate, LLM providers, Ollama]
---

Continue supports multiple authentication methods for integrating with Large Language Model (LLM) providers. This guide covers the three main authentication approaches: API keys, custom headers, and client certificates.

Remember, for most local setups, these advanced authentication methods are not necessary. However, these methods become crucial when working with cloud-based LLMs or when your setup involves additional security measures.

## API Key Authentication

When you use the `apiKey` field, Continue automatically adds the header `"Authorization": "Bearer your-api-key-here"` to the requests.

API key authentication is the most common method. Here's how you can configure it:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "your-openai-api-key-here"
    }
  ]
}

```

## Custom Header Authentication

For scenarios where you need to send custom headers for authentication, such as when running behind a proxy, you can use the `requestOptions.headers` property:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama with Custom Header",
      "provider": "ollama",
      "model": "llama3.1-8b",
      "requestOptions": {
        "headers": {
          "X-Auth-Token": "your-auth-token-here"
        }
      }
    }
  ]
}
```

This approach allows you to send any custom headers needed for authentication.

## Client Certificate Authentication

For setups that require client certificates, you can use the `requestOptions.clientCertificate` property:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama with Certificate",
      "provider": "ollama",
      "model": "llama3.1-8b",
      "requestOptions": {
        "clientCertificate": {
          "cert": "/path/to/ollama-cert.pem",
          "key": "/path/to/ollama-key.pem",
          "passphrase": "optional-passphrase"
        }
      }
    }
  ]
}
```

Ensure the paths to your certificate and key files are correct, and include the passphrase if your key is encrypted.

Note: The paths for the certificate and key can be absolute (like "/path/to/cert.pem") or relative to your home directory (like "~/.continue/cert.pem").

## Combining Authentication Methods

You can combine these methods if your setup requires it. For example, you might need both an API key and a client certificate:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama with API Key and Certificate",
      "provider": "ollama",
      "model": "llama3.1-8b",
      "apiKey": "your-api-key-here",
      "requestOptions": {
        "clientCertificate": {
          "cert": "/path/to/ollama-cert.pem",
          "key": "/path/to/ollama-key.pem",
          "passphrase": "optional-passphrase"
        }
      }
    }
  ]
}
```

Remember to adjust the configuration according to your specific LLM provider and setup requirements.
