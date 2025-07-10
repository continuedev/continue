---
alwaysApply: false
---

Convert all of the styled components in this file into tailwind CSS. If a variable is used that is not already in @theme.ts and @tailwind.config.cjs, then you should figure out where it comes from and try adding that so it can be used. Wherever a function is called to interpolate a value, you can just use inline `styles={{ ... }}`. For ternaries, you could use @cn.ts.
