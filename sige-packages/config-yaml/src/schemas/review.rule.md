No new additions to the ConfigYaml schema should be made for features that are experimental. This is because anything added to config.yaml can't easily be taken away without causing backward-compatibility issues for users that chose to use the setting.

You can tell whether a feature is experimental based off of whether anything was added to the "Experimental Settings" section of `UserSettingsForm.tsx`.
