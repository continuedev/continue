# Julia

Julia is the #37 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

✅ Julia is one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

✅ Julia is one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ Julia is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Julia is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ Julia makes up 3.09 GB of [The Stack dataset](https://arxiv.org/abs/2211.15533)

✅ Julia makes up 0.29 GB of the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

❌ Julia is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Julia is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

❌ Julia is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Julia has 12,402 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

Julia projects have had 39,305 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Julia projects have had 51,276 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Julia projects have had 166,898 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Julia projects have had 52,326 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/LoganKilpatrick1](https://www.reddit.com/r/Julia/comments/zzvkso/comment/j2i6knx/)
> I usually start my own articles with ChatGPT but the truth is that right now, if you want to say something interesting in the Julia space, you mostly need to write it yourself since the volume of content about Julia out there isn’t enough for the outputs of ChatGPT to be very useful since our ecosystem is so small.

[u/Kichae](https://www.reddit.com/r/Julia/comments/112wlle/comment/j8mpgx5/)
> It wasn't trained on sufficient Julia code. As with any machine learning model, ChatGPT is only able to regurgitate what's been fed into it. Also, this behaviour happens with basically every other topic, too. LLMs work by trying to predict what the next word in a sentence would be based on the previous string of words. If a sentence is incomplete, it's going to add a next word. That word is going to be whichever has the highest confidence score, regardless of low that score may actually be. This results in it just making shit up, but often shit that sounds plausible. We've seen CGPT invent academic articles, books, and even entire people because it makes sense to in the sentence it's generating.`

[u/Paravalis](https://www.reddit.com/r/Julia/comments/112wlle/comment/j8qzc0j/)
> I suspect the current language model behind ChatGPT was fed with a lot of code examples from Stack Exchange, but the Julia community mainly uses Discourse instead, which probably wasn't in the training set: https://discourse.julialang.org/