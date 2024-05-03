# C

C is the #11 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

❌ C is not one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

❌ C is not one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ C is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ C is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ C makes up 222.88 GB of [The Stack dataset](https://arxiv.org/abs/2211.15533)

✅ C makes up 183.83 GB of the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

✅ C makes up 48.9 GB of the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ C is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

✅ C makes up 55 GB of the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

C has 400,941 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

C projects have had 1,300,955 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

C projects have had 1,285,709 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

C projects have had 5,240,188 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

C projects have had 3,741,913 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/MyuuDio](https://www.reddit.com/r/C_Programming/comments/17rzzy9/comment/k8mqxv5/)
> Hard agree with the last part. ChatGPT & other AI tools can be pretty awful for non-trivial C code. It often spits out things that might work in other syntactically similar C-style, such as using string literals as switch cases, or concatenating string literals with the + operator. It's the worst nightmare for someone who's actively learning to code; it will confidently answer your question incorrectly, while sounding completely reasonable.

[u/aghast_nj](https://www.reddit.com/r/C_Programming/comments/178cc4l/comment/k4z9cby/?utm_source=share&utm_medium=web2x&context=3)
> ChatGPT is failing you twice. First, because it's telling you about a bogus problem. Second, because it is not telling you about a real problem. The bogus problem is the redeclaration issue. It's technically correct that you will get a diagnostic if you try to define the same local variable twice in the same scope. But the solution there is trivial: don't define it, just re-use it. The more pernicious problem is handling or not handling the failure of realloc. When you overwrite the list variable with the result of realloc there is the possibility that the result is NULL. In that case, you have "lost" your original pointer.

[u/Meatball_Subzero](https://www.reddit.com/r/C_Programming/comments/16geaal/comment/k078frr/?utm_source=share&utm_medium=web2x&context=3)
> I've been using copilot for nearly two years now. For me it's just a nice auto complete. I don't think it ever solves anything for me. It just makes me faster, especially with repetitive shit.