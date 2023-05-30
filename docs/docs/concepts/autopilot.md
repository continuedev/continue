# Autopilot

*TODO: Explain in detail what this is and what its purpose is*

## One sentence definition

The `autopilot` class is the main loop, completing Steps and then deciding the next step and repeating.

## What else to know

An autopilot takes user input from the React app. You can see this happening in `server/notebook.py`. It basically queues user inputs, pops off the most recent, runs that as a "UserInputStep", uses its Policy to run other steps until the next step is None, and then pops off the next user input. When nothing left, just waits for more.

`Autopilot` contains the
- History
- LLM
- Policy
- IDE