# Rust

Rust is the #15 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

✅ Rust is one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

✅ Rust is one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

❌ Rust is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Rust is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ Rust makes up 40.35 GB of [The Stack dataset](https://arxiv.org/abs/2211.15533)

✅ Rust makes up 2.68 GB of the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

✅ Rust makes up 2.8 GB of the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Rust is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

✅ Rust makes up 3.5 GB of the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Rust has 39,147 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

Rust projects have had 400,875 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Rust projects have had 239,196 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Rust projects have had 947,751 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Rust projects have had 941,468 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/remontantcoprology](https://www.reddit.com/r/rust/comments/zgkuq6/comment/izi6p21/?utm_source=share&utm_medium=web2x&context=3)
> I think programming is heading the same way as translation - a machine can give you a first draft, but experience is needed to verify and fix the resulting code. In the case of translation, many tools exist that will translate text from one language to another, but the results may be slightly or wholly inaccurate: knowledge of both the source and target languages is needed to verify the result. The same is applies to code generation by GPT. The combination of a human and machine will probably give better results, faster. But unsupervised code generation in a general sense is still a way off.

[u/JuanAG](https://www.reddit.com/r/rust/comments/zgkuq6/comment/izhfvi3/?utm_source=share&utm_medium=web2x&context=3)
> The issue is that most of the time the code wont compile or have UB so... It could be blazingly fast to give you text but if need 5 or 10 minutes per try to check is doing what i want i prefer to do the code myself and then i am sure is doing what i want. In other langs like Python maybe but in complex langs like C++ or Rust is not as good because of it complexity, i havent tried but in Rust you cant make a buble sort loop without swap(i, j) and GPT could try the usual aproach of array[i] = array[j] which wont work at all

[u/AbleEstablishment155](https://www.reddit.com/r/rust/comments/16iz3fj/is_there_a_specific_llm_for_rust_coding/?utm_source=share&utm_medium=web2x&context=3)
> I searched the huggingface hub for some LLM to help Rust coding. But most of them just for python. does anyone knows some LLM for just for Rust. Or how to build one. thanks