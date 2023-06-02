# Autopilot

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
The **autopilot** is the main loop, completing steps and then deciding the next step and repeating
:::

## Details

The Autopilot class is the center of Continue. Every step is initiated from the Autopilot, which provides it with a ContinueSDK.

- Records history
- Allows reversal
- Injects SDK
- Has policy to decide what step to take next
- Accepts user input and acts on it
- Main event loop
- Contains main classes that are provided through the SDK, including LLM, History, IDE

---

- An autopilot takes user input from the React app
- You can see this happening in `server/gui.py`
- It basically queues user inputs, pops off the most recent, runs that as a "UserInputStep", uses its Policy to run other steps until the next step is None, and then pops off the next user input. When nothing left, just waits for more
- `Autopilot` contains the
  - History
  - LLM
  - Policy
  - IDE
