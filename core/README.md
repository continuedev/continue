# Continue Core

The Continue Core contains functionality that can be shared across web, VS Code, or Node.js server. It is written in TypeScript and contains much of the functionality that was previously inside of the legacy Continue Python Server.

- LLM class
- Token counting and pruning
- Prompt templates
- Prompts
- Loading config file

Since it's written in Typescript, it can be placed directly in the React app without needing to communicate with a server.

Reasons to avoid Python

- Circular imports
- No real type checking
- Fake async
- snake_case
- Doesn't run in browser

---

TODO:

Little stuff:

- create_client_session -> createAxiosConfig from requestOptions

Imports

- tiktoken
- posthog
- chevron

Repetitive

- LLM subclasses
- Slash commands
- Context providers

The important thing is to build backward. Your goal should be to add functionality, not to rebuild what you previously had.

1. Get text streaming from an LLM. One LLM class. FreeTrial.
   - After: complete rest of LLM classes
2. /test slash command is a good one to start with
   - Then the others. but don't need all of them. keep it simple
3. Diff context provider
   - Subgoal: set up IDEProtocol to work over message passing
4. File context provider
   - Need to figure out how to do search
5. History and other storage of state. Do it through the IDE protocol probably? Still want local files.
