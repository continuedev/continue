# Elixir

Elixir is the #30 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

❌ Elixir is not one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

❌ Elixir is not one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ Elixir is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Elixir is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ Elixir is included in [The Stack dataset](https://arxiv.org/abs/2211.15533)

❌ Elixir is not included in the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

❌ Elixir is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Elixir is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

❌ Elixir is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Elixir has 9,510 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

Elixir projects have had 113,018 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Elixir projects have had 65,166 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Elixir projects have had 255,430 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Elixir projects have had 210,145 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/a3th3rus](https://www.reddit.com/r/elixir/comments/16vrhr6/comment/k2xel5z/?utm_source=share&utm_medium=web2x&context=3)
> One day, I needed to implement a priority queue with amortized O(log n) decrease-key operation in Elixir, but I didn't know how, so I consulted Monica (which interfaces GPT-3, I think), and it gave me the code of a whole Elixir module that is absolutely wrong. It was a binary heap implemented using a single list as if it's a mutable array. Furthermore, it won't even compile! I tried to correct the "mistake" GPT made, so I told it more about Elixir, about immutability, about lists in Elixir. I even tried to "inspire" GPT to write other kinds of heaps, like binomial heap and pairing heap, but GPT is so stubborn (though very polite) that it keeps giving me almost the same code over and over again. At last I gave up on GPT and turned to StackOverflow, and just a few words enlightened me (FYI, it's two heaps, one for insertion, one for deletion, and when the top nodes in both heaps have the same key, cancel them out). My conclusion is: AI is useless in some domains when it doesn't have enough learning material in those domains.

[u/erlangsolutions](https://www.reddit.com/r/elixir/comments/13xeh8w/how_chatgpt_improved_my_elixir_code_some_hacks/)
> Using ChatGPT when programming with Elixir can bring several advantages. One of the most significant advantages is that it can provide quick and accurate responses to various programming queries, including syntax and documentation. This can help programmers save time and improve their productivity. Additionally, ChatGPT can offer personalised and adaptive learning experiences based on individual programmers’ skill levels and preferences. This can help programmers learn Elixir more efficiently and effectively.

[D4no0](https://elixirforum.com/t/get-ai-code-generation-tools-to-create-correct-elixir-code-or-else/53931/2)
> The question is: how much boilerplate code do you really write? Elixir compared to other languages has little to none boilerplate, and for moments such as phoenix things, there are configurable generators. I wouldn’t want an AI incapable of problem solving to generate complex code for me, because as tempting as it seems, the productivity decreases a lot if we talk about refactoring generated code compared to creating your own new code.