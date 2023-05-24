# Telemetry

## How it works

- We use Segment to record telemetry about user actions
- We record client-side and server-side events
- This data is sent to a Google BigQuery data warehouse
- Data is only updated daily on the free version of Segment
- You can query this data using the Trevor.io tool

## What we track

### Event

Every time a user takes an action that triggers one of the event types below,
we record the VS Code machine ID, time of the event, and the type of event as
well as some additional properties for some of the events.

### Event types

#### ExtensionActivated

Description: Recorded when the VS Code extension is activated.
Location: Client
Properties

- user_id

#### SuggestionAccepted

Description: Recorded when a code fix suggestion is accepted.
Location: Client
Properties

- user_id

#### SuggestionRejected

Description: Recorded when a code fix suggestion is rejected.
Location: Client
Properties

- user_id

#### UniversalPromptQuery

Description: Recorded when a user asks a question to the prompt opened by `cmd+shift+j`
on MacOS or `ctrl+shift+j` on Windows.
Location: Client
Properties

- user_id
- question

#### ExplainCode

Description: Recorded when the `Explain Code` button is clicked.
Location: Client
Properties

- user_id

#### GenerateIdeas

Description: Recorded when the `Generate Ideas` button is clicked.
Location: Client
Properties

- user_id

#### SuggestFix

Description: Recorded when the `Suggest Fix` button is clicked.
Location: Client
Properties

- user_id

#### CreateTest

Description: Recorded when the `Create Test` button is clicked.
Location: Client
Properties

- user_id

#### DebugThisTest

Description: Recorded when the `Debug This Test` button is clicked.
Location: Client
Properties

- user_id

#### GenerateDocstring

Description: Recorded when a user generates a docstring for a function
using `cmd+shift+l` on MacOS or `ctrl+shift+l` on Windows.
Location: Client
Properties

- user_id

#### CodeExplained

Description: Recorded when the server generates a code explanation.
Location: Server
Properties

- user_id
- language
- traceback
- bug_description
- ranges_in_files
- filesystem
- explanation

#### IdeasGenerated

Description: Recorded when the server generates ideas for how to fix.
Location: Server
Properties

- user_id
- language
- traceback
- bug_description
- ranges_in_files
- filesystem
- ideas

#### FixSuggested

Description: Recorded when the server generates a suggested fix.
Location: Server
Properties

- user_id
- language
- traceback
- bug_description
- ranges_in_files
- filesystem
- suggestion

#### TestCreated

Description: Recorded when the server generates a unit test.
Location: Server
Properties

- user_id
- language
- ranges_in_files
- filesystem
- generated_test

#### DocstringGenerated

Description: Recorded when the server generates a docstring.
Location: Server
Properties

- user_id
- language
- ranges_in_files
- filesystem
- docstring
- line_num

### Future Ideas

Client side

- Collect `Enable Highlight` button clicked
- Collect `Disable Highlight` button clicked
- Collect the files that were edited
- Collect the code at a later time to see what it ultimately ended up
- Collect when a debugging session starts
- Collect when a debugging session ends
- Add an ID for bugs based on debugging window (plus, new stack trace)
