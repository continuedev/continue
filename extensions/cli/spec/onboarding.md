# Onboarding

When a user first runs `cn` in interactive mode, they will be taken through "onboarding". After they have completed onboarding once, they will follow a normal config loading flow.

## Onboarding flow

**The onboarding flow runs when the user hasn't completed onboarding before, regardless of whether they have a valid config.yaml file.**

1. If the --config flag is provided, load this config
2. Otherwise, we will present the user with two options:

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

When something in the onboarding flow is done automatically, we should tell the user what happened.

## Normal flow

**The normal flow runs when the user has already completed onboarding.**

1. If the --config flag is provided, load this config
2. If the user is logged in, look for the first assistant in the selected org
3. If there are no assistants in that org, then look for a local ~/.continue/config.yaml
4. If there is no config.yaml, look for an ANTHROPIC_API_KEY in the environment and manually construct the config object to include just the claude-4-sonnet model with that API key
5. If none of the above, then bring the user to step 3 of the onboarding flow
