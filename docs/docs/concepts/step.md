# Step

*TODO: Explain in detail what this is and what its purpose is*

## One sentence definition

A `step` is 

## What else to know

Steps can be composed together

### Step methods

#### `run` (required)

the code that should run when executed by the policy

#### `description` (optional)

the definition of what the step does in natural language

#### `reverse` (optional)

the code that should run when the step is reversed

#### `modify` (optional)

the code that should run when the step is rerun with feedback

*TODO: Move list / description of all steps and recipes to the place where people will be able to use and update them*

### Steps & recipes

#### Core

##### RunCommandStep

##### EditCodeStep

#### ManualEditStep

### Community

#### CreateTableStep

Create a table in TypeORM

#### MigrationStep

Create and run an alembic migration

##### Parameters

- `edited_file`: 

#### WritePytestsStep

Write unit tests for this file.

##### Parameters

- for_filepath (required): the path of the file that unit tests should be created for