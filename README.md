# Continue CLI

A command-line interface for Continue Dev that provides an interactive AI-assisted development experience.

## Features

- 🤖 Interactive AI Assistant Chat
- 🔐 Secure Authentication via WorkOS
- 🛠️ Built-in Development Tools
- ⚡ Real-time Response Streaming
- 🎯 Slash Command Support
- 🤫 Headless Mode for Automation

## Installation

```bash
npm install @continuedev/cli -g
```

## Usage

### Basic Usage

```bash
continue-cli
```

### With Custom Assistant

```bash
continue-cli --assistant-path /path/to/assistant.json
```

### Headless Mode

```bash
continue-cli --headless --prompt "Your command here"
```

## Available Commands

The CLI supports various slash commands during interaction:

- `/help` - Display help information
- `/exit` - Exit the CLI
- Additional commands available during chat sessions

## Development

### Prerequisites

- Node.js (version specified in .nvmrc)
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

4. Start in development mode:

```bash
npm start
```

### Testing

Run the test suite:

```bash
npm test
```

## Project Structure

```
src/
├── auth/           # Authentication implementation
├── tools/          # CLI tools and utilities
├── index.ts        # Main entry point
├── args.ts         # Command line argument parsing
├── client.ts       # Client implementation
├── mcp.ts          # Model Context Protocol integration
└── ...            # Various utility files
```

## Dependencies

- `@continuedev/*` packages for core functionality
- `@workos-inc/node` for authentication
- `openai` for AI capabilities
- Various utility packages (chalk, axios, etc.)

## License

Apache-2.0 - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the GitHub issue tracker.
