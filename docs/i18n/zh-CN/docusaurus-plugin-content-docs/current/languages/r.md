# R

R is the #22 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

✅ R is one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

✅ R is one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ R is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ R is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ R is included in [The Stack dataset](https://arxiv.org/abs/2211.15533)

❌ R is not included in the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

❌ R is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ R is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

❌ R is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

R has 499,872 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

R projects have had 51,800 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

R projects have had 88,649 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

R projects have had 506,309 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

R projects have had 91,654 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/2truthsandalie](https://www.reddit.com/r/Rlanguage/comments/17q56xq/comment/k8b2phr/?utm_source=share&utm_medium=web2x&context=3)
> It's even helpful for example datasets. If you want to test or play around it will create a dataframe example. Also if you know one programming language it can help translate. It will even rewrite the code to look better. E.g. write this code in python pandas but make it more readable like r dplyr. Anything regex is nice as I don't have to hope a specific example is on stack overflow. Chat cpt from my experience will often favor going things with for loops instead of taking advantage of dplyr or pandas functions. With everything chat gpt tho check the code as it will confidently give you an answer and even print out a fake output. Often pointing out its error gets chatgpt to fix the code.

[u/DrLyndonWalker](https://www.reddit.com/r/Rlanguage/comments/17q56xq/comment/k8bi6nq/?utm_source=share&utm_medium=web2x&context=3)
> I have found it hit and miss. I was able to knock up simple Shiny apps in a minute (https://youtu.be/8oJ1HtkpDt0) but have had it write non-sense code for some other things I was trying (especially webscraping). GPT Studio is pretty good (demo here https://youtu.be/QQfDTLExoNU) but has someone else mentioned, take a look at Github Copilot

[u/jrdubbleu](https://www.reddit.com/r/Rlanguage/comments/17q56xq/comment/k89wmhi/?utm_source=share&utm_medium=web2x&context=3)
> I do it constantly, not only for debugging which it is spectacular at, but for especially tedious things like using ggplot. If you can think it, GPT-4 and the other specialized models can code it. The real key is to put thought into the question you want to answer with the code and then to very deliberately tell the GPT what to do. For example, “I have a data frame with x, y, z variables. Please write R code to perform a, b, c statistical analysis. Place the results into a variable called results.” And so on.