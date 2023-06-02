# continue

Bug report to fix in 1/10th the time.

Our debugging assistant automatically handles tedious portions of the debugging process, such as:

- Fault localization
- Enumerating potential error sources
- Generating fixes
- Pulling in outside context
- Following data flows
- Parsing tracebacks
- Generate unit tests
- Generate docstrings

# Features

### Ask a Question

`cmd+shift+j` to open up a universal search bar, where you can ask questions of your codebase in natural language.

### Fault Localization

Either manually highlight code snippets you think are suspicious, or let us find them for you.

### Generate a Fix

Once Continue has code snippets to work with, it can generate a fix. Just click to accept or reject, or make the tweak you need.

### Stacktrace Parsing

Any stacktrace that appears in your VS Code terminal will be caught by us so we can immediately begin the debugging process. For small bugs that you might have quickly solved, we'll just speed up the process to be nearly instantaneous.

### Generate Unit Tests and Docstrings

Use `cmd+shift+i` to generate a unit test for the function surrounding your cursor position, and `cmd+shift+l` to generate a docstring.
