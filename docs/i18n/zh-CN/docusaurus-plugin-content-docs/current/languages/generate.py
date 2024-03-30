import csv

data = {}
with open('languages.csv', 'r') as file:
    reader = csv.DictReader(file)
    for row in reader:
        data = row
        break

language = data['language']
stack_overflow_ranking = data['so_2023_language_rank']

introduction = f'''# {language}

Recently, many folks have been claiming that their LLM is the best at coding. Their claims are typically based off self-reported evaluations on the [HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=most%20common%20benchmarks-,1.%20HumanEval,-Creator%3A%20OpenAI). But when you look into that benchmark, you realize that *it only consists of 164 Python programming problems.*

This led me down a rabbit hole of trying to figure out how helpful LLMs actually are with different programming, scripting, and markup languages. I am estimating this for each language by reviewing LLM code benchmark results, public LLM dataset compositions, available GitHub and Stack Overflow data, and anecdotes from developers on Reddit. Below you will find what I have figured out about {language} so far.

**Do you have any feedback or perhaps some anecdotes about using LLMs with {language} to share?**

---

'''

stack_overflow = f'''{language} is the #{stack_overflow_ranking} most popular language according to the [2023 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2023/#section-most-popular-technologies-programming-scripting-and-markup-languages).\n\n'''

benchmarks = "## Benchmarks\n\n"

if data["multiple"] == "N/A":
    multiple = f'''❌ {language} is not one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)\n\n'''
else:
    multiple = f'''✅ {language} is one of the 19 languages in the [MultiPL-E benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=couple%20notable%20mentions-,4.%20MultiPL%2DE,-Creator%3A%20Northeastern)\n\n'''

if data["babel"] == "N/A":
    babel = f'''❌ {language} is not one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)\n\n'''
else:
    babel = f'''✅ {language} is one of the 16 languages in the [BabelCode / TP3 benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=amazon%2Dscience/mxeval-,12.%20BabelCode%20/%20TP3,-Creator%3A%20Google)\n\n'''

if data["mbxp"] == "N/A":
    mbxp = f'''❌ {language} is not one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)\n\n'''
else:
    mbxp = f'''✅ {language} is one of the 13 languages in the [MBXP / Multilingual HumanEval benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=11.%20MBXP%20/%20Multilingual%20HumanEval)\n\n'''

if data["humaneval_x"] == "N/A":
    humaneval_x = f'''❌ {language} is not one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)\n\n'''
else:
    humaneval_x = f'''✅ {language} is one of the 5 languages in the [HumanEval-X benchmark](https://blog.continue.dev/an-introduction-to-code-llm-benchmarks-for-software-engineers/#:~:text=Some%20multilingual%C2%A0benchmarks-,10.%20HumanEval%2DX,-Creator%3A%20Tsinghua)\n\n'''

datasets = "## Datasets\n\n"

if data["stack_gb"] == "0":
    stack = f'''❌ {language} is not included in [The Stack dataset](https://arxiv.org/abs/2211.15533)\n\n'''
else:
    stack = f'''✅ {language} makes up {data["stack_gb"]} GB of [The Stack dataset](https://arxiv.org/abs/2211.15533)\n\n'''

if data["codeparrot_gb"] == "0":
    codeparrot = f'''❌ {language} is not included in the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)\n\n'''
else:
    codeparrot = f'''✅ {language} makes up {data["codeparrot_gb"]} GB of the [CodeParrot dataset](https://huggingface.co/datasets/codeparrot/github-code)\n\n'''

if data["alphacode_gb"] == "0":
    alphacode = f'''❌ {language} is not included in the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)\n\n'''
else:
    alphacode = f'''✅ {language} makes up {data["alphacode_gb"]} GB of the [AlphaCode dataset](https://arxiv.org/abs/2203.07814)\n\n'''

if data["codegen_gb"] == "0":
    codegen = f'''❌ {language} is not included in the [CodeGen dataset](https://arxiv.org/abs/2203.13474)\n\n'''
else:
    codegen = f'''✅ {language} makes up {data["codegen_gb"]} GB of the [CodeGen dataset](https://arxiv.org/abs/2203.13474)\n\n'''

if data["polycoder_gb"] == "0":
    polycoder = f'''❌ {language} is not included in the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)\n\n'''
else:
    polycoder = f'''✅ {language} makes up {data["polycoder_gb"]} GB of the [PolyCoder dataset](https://arxiv.org/abs/2202.13169)\n\n'''

presence = f'''## Stack Overflow & GitHub presence

{language} has {data["so_tags"]} [tags on Stack Overflow](https://stackoverflow.com/tags)

{language} projects have had {data["github_prs"]} [PRs on GitHub since 2014](https://madnight.github.io/githut/#/pull_requests/2023/3)

{language} projects have had {data["github_issues"]} [issues on GitHub since 2014](https://madnight.github.io/githut/#/issues/2023/3)

{language} projects have recieved {data["github_pushes"]} [pushes on GitHub since 2014](https://madnight.github.io/githut/#/pushes/2023/3)

{language} projects have recieved {data["github_stars"]} [stars on GitHub since 2014](https://madnight.github.io/githut/#/stars/2023/3)
'''

anecdotes = f'''## Anecdotes from developers

[{data["anecdote_1_author"]}]({data["anecdote_1_url"]})
> {data["anecdote_1_content"]}

[{data["anecdote_2_author"]}]({data["anecdote_2_url"]})
> {data["anecdote_2_content"]}

[{data["anecdote_3_author"]}]({data["anecdote_3_url"]})
> {data["anecdote_3_content"]}

---

'''

conclusion = f'''Original source: https://github.com/continuedev/continue/tree/main/docs/docs/languages/{language.lower()}.md

Data for all languages I've looked into so far: https://github.com/continuedev/continue/tree/main/docs/docs/languages/languages.csv
'''

content = introduction + stack_overflow + benchmarks + multiple + babel + mbxp + humaneval_x + datasets + stack + codeparrot + alphacode + codegen + polycoder + presence + anecdotes + conclusion

with open(f'{language.lower()}.md', 'w') as f:
    f.write(content)