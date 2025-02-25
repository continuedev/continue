---
title: Teams Tier
description: Teams Tier
keywords: [governance, teams, team, tier]
---

# Teams Tier

Everything in the solo tier is available in the teams tier. Organization admins can govern the blocks and assistants that can be created, shared, and used by their developers, ensuring only approved blocks and assistants are used using the allow / block list. In addition, the organization admin can manage organization-level secrets with a secure proxy and create org secrets that can be used by anyone in your organization.

Org secrets are assumed to not be shareable with the user (e.g. you are a team lead who wants to give team members access to models without passing out API keys). In this case, the LLM requests are proxied through Continue (api.continue.dev or the on-premise proxy) and the secrets are never sent to the IDE extensions. The data plane can be separated from the control with an on-premises proxy that can be deployed in your own cloud and ensure no code or other sensitive data leaves your environment.

[**View tier pricing**](https://hub.continue.dev/pricing)
