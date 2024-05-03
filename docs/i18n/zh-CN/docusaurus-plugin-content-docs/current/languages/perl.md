# Perl

Perl is the #29 most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).

## Benchmarks

✅ Perl is one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)

❌ Perl is not one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)

✅ Perl is one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)

❌ Perl is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)

## Datasets

✅ Perl makes up 5.5 GB of [The Stack dataset](https://arxiv.org/abs/2211.15533)

✅ Perl makes up 4.7 GB of the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)

❌ Perl is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)

❌ Perl is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)

❌ Perl is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)

## Stack Overflow & GitHub presence

Perl has 67,938 [tagged questions on Stack Overflow](https://stackoverflow.com/tags)

Perl projects have had 125,129 [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

Perl projects have had 117,426 [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

Perl projects have had 634,214 [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

Perl projects have had 188,697 [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)

## Anecdotes from developers

[u/briandfoy](https://www.reddit.com/r/perl/comments/10j0k00/comment/j5ki948)
> There are a few problems with this, and I noticed the exact same thing with the GitHub Copilot. It's barfing out examples it was trained on with no idea about what they do, whether they work, and if they are current. Transaction objects no longer have a success method. This was deprecated for a long time ago and finally removed in version 9. The error method returns a single value. Minor problem, but still cruft that shouldn't be there. Call json on the response to get the data structure rather than doing this yourself. Even then, using JSON directly, while fine, skips over the Mojo::JSON::decode_json. It's a bit of a pain in the butt, but work hard to use the same parser everywhere in an application since they tend to have slight differences (say, like how they represent null, true, or false). Somewhere along the line, ChatGPT saw this code or something very similar. It then returns it to you with no intelligence about what it is doing or what it should do. It's very likely that the source ChatGPT saw is not only old, but also unsophisticated. You're likely just cargo-culting off StackOverflow with extra steps. But, this also isn't the way you probably want to write code. You don't want to return the token really, You want to add that to the user-agent so it provides it in every request without additional code from you. I have plenty of examples in Mojo Web Clients. That's another problem with the source material for these sorts of things: it's training itself off public data, but often our examples are mere demonstrations of ideas rather than advice on reliable software engineering (since we aren't going to write a book for every question someone asks).

[u/nobono](https://www.reddit.com/r/perl/comments/10j0k00/comment/j5l9s1c/)
> "Somewhere along the line, ChatGPT saw this code or something very similar. It then returns it to you with no intelligence about what it is doing or what it should do." IMO, this is quite irrelevant, because you must understand that whatever output - be it code, poems or whatever - from an AI-assisted service is not perfect. The main point is: it helps. And that's its main selling point today, because that's how StackOverflow also works: sometimes it's perfect, but most of the times it just helps, maybe because you have addressed the wrong audience, didn't word your question/problem correctly or otherwise. With ChatGPT you get an instant reply, and you can ask it to refine its reply. Instantly. Rinse and repeat. So if it use StackOverflow data (which I assume it does) it's already better in the sense that it's instant and filters out noise, especially personal attacks, or otherwise replies that intimidates the person asking the questions. "It then returns it to you with no intelligence about what it is doing or what it should do." Let's be honest, we have all been there and/or we have had colleagues who fits that description. :)

[u/its_a_gibibyte](https://www.reddit.com/r/perl/comments/14capfv/comment/jol2a4b)
> You mentioned being new to perl and programming. Personally, I think ChatGPT is a great resource for these types of question. I asked it your question and copied the function from csv2fasta.pl