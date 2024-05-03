# Haskell

Haskell is the #32 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

❌ Haskell is not one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

✅ Haskell is one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ Haskell is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Haskell is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ Haskell makes up 6.95 GB of [The Stack dataset](https://arxiv.org/abs/2211.15533)

✅ Haskell makes up 1.85 GB of the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

❌ Haskell is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Haskell is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

❌ Haskell is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Haskell has 50,979 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

Haskell projects have had 106,539 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Haskell projects have had 146,857 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Haskell projects have had 646,012 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Haskell projects have had 306,235 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/lgastako](https://www.reddit.com/r/haskell/comments/zede58/comment/iz68s9c/?utm_source=share&utm_medium=web2x&context=3)
> I've been generating a ton of Haskell code with it and it's been fantastic. I have a driver for content addressable storage in my side project, it's pretty simple, but it still took me a few hours each to implement local filesystem and MinIO drivers with tests and ChatGPT did the bulk of the work for Redis and LevelDB implementations in minutes. I've also found it much easier to work with on Haskell code than on python or JS. Obviously some of this is the usual reasons why I would find Haskell code easier to deal with than dynamic languages but I think that the effect is amplified with ChatGPT because the "if it compiles it works" affect gives me much more confidence that what it generated isn't missing anything important than with the other languages, so I can move much faster.

[u/qqwy](https://www.reddit.com/r/haskell/comments/16o5u8e/comment/k1jc68v/?utm_source=share&utm_medium=web2x&context=3)
> Personally, I've been using Copilot mostly in Ruby (work...) and Haskell, and it is much better at predicting Haskell code. I think it's because Haskell has so much context (type signatures, purity, only imported modules are in scope) which greatly restrict what you can do in a particular function and thus Copilot's suggestions seem to be much more often in line with what I wanted to write.

[Chris Smith](https://cdsmithus.medium.com/pair-programming-with-chatgpt-haskell-1c4490b71da6)
> Here, I present the (lightly edited) story of using ChatGPT conversationally to solve a non-trivial problem in Haskell. It definitely gets some things wrong, and it’s still unclear whether co-developing this with ChatGPT made anything easier than it would have been otherwise. But in any case, it was definitely a different and less lonely experience than just programming on my own.