# Erlang

Recently, many folks have been claiming that their LLM is the best at coding. Their claims are typically based off self-reported evaluations on the [HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=most%20common%20benchmarks-,1.%20HumanEval,-Creator%3A%20OpenAI). But when you look into that benchmark, you realize that *it only consists of 164 Python programming problems.*

This led me down a rabbit hole of trying to figure out how helpful LLMs actually are with different programming, scripting, and markup languages. I am estimating this for each language by reviewing LLM code benchmark results, public LLM dataset compositions, available GitHub and Stack Overflow data, and anecdotes from developers on Reddit. Below you will find what I have figured out about Erlang so far.

**Do you have any feedback or perhaps some anecdotes about using LLMs with Erlang to share?**

---

Erlang is the #38 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

❌ Erlang is not one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

❌ Erlang is not one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ Erlang is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Erlang is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

❌ Erlang is not included in [The Stack dataset](https://arxiv.org/abs/2211.15533)

❌ Erlang is not included in the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

❌ Erlang is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Erlang is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

❌ Erlang is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Erlang has 9,621 [tags on Stack Overflow](https://stackoverflow.com/tags)

Erlang projects have had 70,890 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Erlang projects have had 49,786 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Erlang projects have recieved 249,209 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Erlang projects have recieved 127,120 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)
## Anecdotes from developers

[u/Ranugad](https://www.reddit.com/r/erlang/comments/11kl57z/comment/jbbw94t)
> It seems like ChatGPT doesn't know that much Erlang.

[Rich_Morin](https://elixirforum.com/t/asking-chatgpt-to-translate-erlang-to-elixir/53548)
> I recently asked ChatGPT to translate some Erlang code into Elixir. Here’s an edited transcript, for your amusement and edification…

[u/boy-griv](https://www.reddit.com/r/AskProgramming/comments/10tave8/comment/j78bvj5)
> I don’t think anything automated is going to work well. ChatGPT might be interesting but you’ll almost certainly have to fix it up quite a bit. https://learnxinyminutes.com/docs/erlang/ gives a quick rundown on erlang syntax/semantics and https://learnyousomeerlang.com/ is a good book on it

---

Original source: https://github.com/continuedev/continue/tree/main/docs/docs/languages/erlang.md

Data for all languages I've looked into so far: https://github.com/continuedev/continue/tree/main/docs/docs/languages/languages.csv
