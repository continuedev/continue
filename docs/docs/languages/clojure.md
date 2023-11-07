# Clojure

Clojure is the #36 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

❌ Clojure is not one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

❌ Clojure is not one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ Clojure is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Clojure is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ Clojure is included in [The Stack dataset](https://arxiv.org/abs/2211.15533)

❌ Clojure is not included in the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

❌ Clojure is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Clojure is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

❌ Clojure is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Clojure has 17,630 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

Clojure projects have had 112,757 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Clojure projects have had 84,128 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Clojure projects have had 518,359 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Clojure projects have had 272,970 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/noprompt](https://www.reddit.com/r/Clojure/comments/148nhuj/comment/jo2z2n8)
> I've been using Copilot since December 2022. It sucks for Clojure but can be great for other languages like Python, JavaScript, SQL, etc. if you know how to prompt it. As other have mentioned, Copilot excels at reducing boilerplate and picking up on patterns. For example, lets say there is a table of data in a markdown document and you want to convert it to a vector of maps. You can copy/paste the markdown table into your buffer as a comment and just start writing the data structure you want it to be, Copilot will figure it out and complete it. Its also useful for generating random utility functions. Recently in JavaScript, I typed `function lerp` (linear interpolation) and it pretty quickly filled it in. I had an array of hex color values that I wanted to be RGB and I wanted to double the number of values by interpolating between them. All I had to do was type that in a comment and wait a second before it gave me a working rough draft of the function. Copilot can actually do a lot of these things for Clojure but when I was trying to use it I found myself consistently having to fix issues with delimiters, typically round braces. Eventually, I just gave up on it. Maybe I'll give it another shot when Copilot-X releases. ChatGPT is much more useful for Clojure than Copilot. It does hallucinate and get some things wrong but overall its awesome for generating documentation, explaining code, translating diffs into PR notes, and exploring ideas. I've found it very useful for random Java questions and then translating the answers into mostly working Clojure code. These things are handy tools and have quirks but they're going to get better. It's a great time to be a cosmopolitan (polyglot) programmer.

[waffletower](https://news.ycombinator.com/item?id=35803856)
> No Clojure. No Julia. No Haskell. No Racket. No Scheme. No Common Lisp. No OCaml. And, as much as I despise Microsoft, No C#. No F#. No Swift. No Objective-C. No Perl. No Datalog. A glaringly lacking choice of languages.

[@EricTheTurner](https://x.com/EricTheTurner/status/1600344406166380544?s=20)
> FizzBuzz was once a common programming exercise used for screening software developers (maybe it still is?)  I told chatGPT to "Write an efficient fizz buzz function in Clojure".