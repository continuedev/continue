# Continue Deployment Mirror

This repository is used to deploy Continue after adding non-open-source features.

It is not a "fork" because GitHub doesn't allow private forks of public repositories.

To keep it up-to-date:

`git fetch upstream` and `git rebase upstream/preview` or `git rebase upstream/main`.

Pushing to either the `main` branch or the `preview` branch will trigger a deployment to the respective environment.

You may need to push with `git push --force-with-lease origin preview`
