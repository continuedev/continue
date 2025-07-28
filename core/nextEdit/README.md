# Next Edit Prediction

## What is it?

## How is it different from autocomplete?

## Where are we right now?

- Users can decide to switch between autocomplete and next edit.
- Next edit triggers at the same time autocomplete is triggered, via vscode's inline completion provider.
- The following happens after the trigger:
  - User's current cursor position is captured.
  - We define an editable range, ±5 lines from the current cursor position.
  - User's most recent edit is captured as a unified diff. (this is currently buggy)
  - This is sent to the model, which returns a new editable range with next edit predictions.
  - We display this new editable range in a SVG decoration.
  - User can either tab to accept or esc to reject.
    - On accept, the old editable range will be replaced by the new editable region. The cursor will be moved to the last line containing some change.
    - On reject, nothing happens.

## What needs to be worked on?

- User edit captures.
- Find a better way to trigger next edit (this links back to the diff capture problem).
  - We can see that next edit triggers as soon as the user accepts a change. This is because autocomplete runs the same way.
  - I think autocomplete has some filter logic that doesn't display the ghost text under some conditions, which I am guessing are the following:
    - The model does not have any more completions to create.
    - The prediction at the cursor location has been cached.
- JetBrains integration.
