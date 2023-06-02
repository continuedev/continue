# History

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
The **history** is the ordered record of all past steps
:::

## Details

History stores a list ("timeline") of HistoryNodes. Each HistoryNode contains the Step with parameters, the Observation returned by the step, and the depth of the step (just so we can understand the tree structure, and what called what, and display as a tree if we wanted). History has a current_index, which can be smaller than the length of the timeline if some steps have been reversed (in which case GUI displays them with lower opacity). History class mostly responsible for maintaining order of history during reversals, grabbing most recent steps, or other things that should be bottlenecked through reliable access methods.

- What step data and metadata is stored in the history?
