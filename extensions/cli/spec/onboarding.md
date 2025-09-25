# Onboarding

When a user first runs `cn` in interactive mode, they will be taken through "onboarding". After they have completed onboarding once, they will follow a normal config loading flow.

## Onboarding flow

**The onboarding flow runs when the user hasn't completed onboarding before, regardless of whether they have a valid config.yaml file.**

1. If the --config flag is provided, load this config
2. If the CONTINUE_USE_BEDROCK environment variable is set to "1", automatically use AWS Bedrock configuration and skip interactive prompts
3. Present the user with available options:

   - Log in with Continue: log them in, which will automatically create their assistant and then we can load the first assistant from the first org
   - Enter your Anthropic API key: let them enter the key, and then either create a ~/.continue/config.yaml with the following contents OR update the existing config.yaml to add the model

   ```yaml
   name: Local Config
   version: 1.0.0
   schema: v1

   models:
     - uses: anthropic/claude-4-sonnet
       with:
         ANTHROPIC_API_KEY: <THEIR_ANTHROPIC_API_KEY>
   ```

   When CONTINUE_USE_BEDROCK=1 is detected, it will use AWS Bedrock configuration. The user must have AWS credentials configured through the standard AWS credential chain (AWS CLI, environment variables, IAM roles, etc.).

When something in the onboarding flow is done automatically, we should tell the user what happened. For example, when CONTINUE_USE_BEDROCK=1 is detected, the CLI displays: "✓ Using AWS Bedrock (CONTINUE_USE_BEDROCK detected)"

### AWS Bedrock Environment Variable

Users can bypass the interactive onboarding menu by setting the `CONTINUE_USE_BEDROCK` environment variable to "1":

```bash
export CONTINUE_USE_BEDROCK=1
cn <command>
```

This will:

- Skip the interactive onboarding prompts
- Automatically configure the CLI to use AWS Bedrock
- Require that AWS credentials are already configured through the standard AWS credential chain
- Display a confirmation message to the user
- Mark onboarding as completed

## Normal flow

**The normal flow runs when the user has already completed onboarding.**

1. If the --config flag is provided, load this config
2. If the user is logged in, look for the first assistant in the selected org
3. If there are no assistants in that org, then look for a local ~/.continue/config.yaml
4. If there is no config.yaml, look for an ANTHROPIC_API_KEY in the environment and manually construct the config object to include just the claude-4-sonnet model with that API key
5. If none of the above, then bring the user to step 3 of the onboarding flow
