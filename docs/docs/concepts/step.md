# Step

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
A **step** is a simple action that the LLM should take as part of a sequence that collectively completes some task
:::

## Details

- A `Step` is a Pydantic class inheriting from `Step`
- Steps implement the `run` method, which takes a ContinueSDK as its only parameter
- The ContinueSDK gives all the utilities you need to easily write recipes (Steps)
- It also implements the `describe` method, which just computes a textual description of what happened when the `run` method was called
- Can save attributes in `run` if you want, or just have a default `describe`, or not even implement it, in which case the name of the class is used
- Any parameters to a Step are defined as attributes to the class without a double leading underscore (those with this are private).
- Steps can be composed together

## Step methods

### `run` (required)

the code that should run when executed by the policy

### `description` (optional)

the definition of what the step does in natural language

### `reverse` (optional)

the code that should run when the step is reversed

### `modify` (optional)

the code that should run when the step is rerun with feedback

**TODO: Move the below list / description of all steps and recipes to the place where people will be able to use, update, share them**

## Steps & recipes

### Core

#### RunCommandStep

#### EditCodeStep

### ManualEditStep

## Community

### CreateTableStep

Create a table in TypeORM

### MigrationStep

Create and run an alembic migration

#### Parameters

- `edited_file`:

### WritePytestsRecipe

Write unit tests for this file.

#### Parameters

- for_filepath (required): the path of the file that unit tests should be created for
