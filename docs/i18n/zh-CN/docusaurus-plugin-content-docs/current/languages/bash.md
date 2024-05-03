# Bash

Bash is the #7 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

✅ Bash is one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

❌ Bash is not one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ Bash is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Bash is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ Bash makes up 8.69 GB of [The Stack dataset](https://arxiv.org/abs/2211.15533)

✅ Bash makes up 3.01 GB of the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

❌ Bash is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Bash is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

❌ Bash is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Bash has 154,693 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

Bash projects have had 866,313 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Bash projects have had 574,292 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Bash projects have had 3,605,350 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Bash projects have had 2,121,149 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/[deleted]](https://www.reddit.com/r/bash/comments/124h7gj/comment/jdzbtvp/?utm_source=share&utm_medium=web2x&context=3)
> chatgpt is very bad at bash. Every script that someone has posted here has had some really glaring errors, often data-destructive ones. In general for every single use-case of chatgpt (or any other generative model) unless you understand the correct output you should not trust it. You can use it to produce documents and reports or even scripts, but you should always read the output carefully and validate that what it says is correct.

[u/RandomXUsr](https://www.reddit.com/r/bash/comments/zix2am/comment/iztmsp3/?utm_source=share&utm_medium=web2x&context=3)
> I've tried getting it to write some code. Very little is useful. It still very much requires education and experience with the tools you use in order to get effective, clean, and efficient code. I had tried some python scripts, but you need to specify libraries and tools to be used, and it doesn't do that well. As it learns more, it may become better at this, but for now it's a neat toy without real world benefits

[u/stepbroImstuck_in_SU](https://www.reddit.com/r/bash/comments/123buum/comment/jduund7/?utm_source=share&utm_medium=web2x&context=3)
> This is more general advice for using chatGPT for generating bash scripts. chatGPT is a powerful tool, but it has both general and bash/linux related weaknesses. Never run script you don’t understand. That is a hard pill to shallow when learning bash, but thankfully you can ask chatGPT to explain its reasoning. To be sure, open a new conversation and ask for explanation of part of the code there. You can also ask another instance for a general explanation of a new syntax or command, and then cross-check the original code. After seeing what chatGPT knows about an individual command, it doesn’t hurt to quicklycheck the man-page anyway. ChatGPT is prone for using “general” syntax and flags even when some command doesn’t exist. Lastly, commands can change through years and environments. Your man-pages tell you what version you have. It’s a good strategy to ask if any tools already exist for the task or are build in, before asking for a bash script. For example you could script dropping your ssh-key in a remote machines .ssh-dir and then appending it to the trusted-keys file (or in folder) - or you can just use the ssh commands build in add-key option. There are a lot of tools build in to your average linux installation, and your distros repos are full of even more lightweight, trustworthy tools (as long as you stick to the official repos). If you aren’t exactly sure how a script behaves or if the syntax is robust, create your own test environments. You can create virtual (or real) directory structures, quickly fill them with very small files and run the script without touching your actual data. Ask chatGPT for more information (and use above steps to understand what it says). Related to the last point, pay attention to especially these aspects of any script chatGPT spews back: hardcoded paths (or less strictly, any path that isn’t declared as a variable on the start of the script). If instead of a robust test environment, you just use a directory with subdirectories, hardcoded paths can escape that environment,  connections outside your machine/local network: While I feel it is unlikely that chatGPT will compromise your system by opening an unsafe connection to unsafe address, the risk is worth mitigating. What if the first guy who got that address noticed it’s not used, and bought it to distribute malware, hoping chatGPT offers it again? But more likely problem is that you can rapidly pull a lot of data from the internet. It just opens up more doors to make a mess,  modifying files in /etc, or your bootloader. You can cause all kinds of damage, including permanently disabling rights to modify the files to fix it (misconfigured privileges), making your system unbootable (fstab, grub), and just generally messing up your system. Back it up before any changes, read the man-pages twice, make small tests (and remember you usually need to reload systemd or reboot before changes take effect)