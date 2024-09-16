# Pieces OS

Pieces OS is a local AI-powered development tool that can be integrated with Continue. This provider allows you to use Pieces OS for completions and other AI-assisted tasks.

## Setup

1. Ensure you have Pieces OS installed locally on your machine.
2. The Pieces OS API server should be running on your local machine, typically on port 1000.

## Configuration

To use Pieces OS with Continue, update your `~/.continue/config.json` file as follows:
```json
{
  "models": [
    {
      "title": "Pieces OS",
      "provider": "pieces_os",
      "model": "pieces_os",
      "apiBase": "http://localhost:1000"
    }

```

### Configuration Options

- `title`: A custom name for your Pieces OS model configuration.
- `provider`: Must be set to `"pieces_os"`.
- `model`: The model identifier for Pieces OS. Default is `"pieces_os"`.
- `apiBase`: The base URL for the Pieces OS API. Default is `"http://localhost:1000"`.

## Usage

Once configured, you can use Pieces OS like any other model provider in Continue. The integration will use the Pieces OS API for completions and other supported operations.
