# Scala

Scala is the #28 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

✅ Scala is one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

❌ Scala is not one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

✅ Scala is one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Scala is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ Scala makes up 14.87 GB of [The Stack dataset](https://arxiv.org/abs/2211.15533)

✅ Scala makes up 3.87 GB of the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

✅ Scala makes up 4.1 GB of the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Scala is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

✅ Scala makes up 1.8 GB of the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Scala has 111,969 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

Scala projects have had 605,988 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Scala projects have had 271,184 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Scala projects have had 1,508,526 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Scala projects have had 540,327 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/markehammons](https://www.reddit.com/r/scala/comments/124ocqh/scala_and_chatgpt/)
> Today I decided to test it by asking how one would use Scala 3 macros to get the types of the inputs and outputs of a method. It had some decent suggestions to do that for someone that is new to macros, but a lot of its answer was false, suggesting people use something called QuotesContext, not recognizing properly what extension methods are available for the Symbol type, and worst of all, trying to splice Type values into an Expr. If they can manage to get chatgpt to actually tell the truth consistently (like saying "I don't know how to do that" rather than just lying) I think it will be a nice resource for discovering how to do stuff you don't currently know how to do. Sadly, it's still got a nasty habit of making stuff up.

[u/agilesteel](https://www.reddit.com/r/scala/comments/ovoc8n/github_copilot_for_scala_does_it_work/)
> Well...this is a very hold thread but I'm using the latest copilot for scala available today of this post. I mostly use the ZIO framework. I was skeptical at first but I'm finding the suggestions get smart quickly and it is generating a lot of code fragments pretty well. I'm not claiming I can live without it, but as of today, I'm thinking it works pretty well for my scenarios. I could easily see not wanting to code without in the near future.  I think using a framework like ZIO makes it easier to generate code fragments because the ZIO framework has a fairly predictable surface area, but that's just a guess.

[u/k1v1uq](https://www.reddit.com/r/ChatGPTCoding/comments/zpunkt/comment/j25ftsr/?utm_source=share&utm_medium=web2x&context=3)
> I wanted to start a new Scala project based on Clean Architecture aka dependency inversion. So I asked for a basic example to demo the principles. There was a lot of pretty code but ultimately it had no idea what this was about. The code was bs.