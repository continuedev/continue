from transformers import AutoTokenizer, AutoModelForCausalLM
from transformers import GPT2TokenizerFast

gpt2_tokenizer = GPT2TokenizerFast.from_pretrained("gpt2")
def count_tokens(text: str) -> int:
    return len(gpt2_tokenizer.encode(text))

# TODO move this to LLM class itself (especially as prices may change in the future)
prices = {
    # All prices are per 1k tokens
    "fine-tune-train": {
        "davinci": 0.03,
        "curie": 0.03,
        "babbage": 0.0006,
        "ada": 0.0004,
    },
    "completion": {
        "davinci": 0.02,
        "curie": 0.002,
        "babbage": 0.0005,
        "ada": 0.0004,
    },
    "fine-tune-completion": {
        "davinci": 0.12,
        "curie": 0.012,
        "babbage": 0.0024,
        "ada": 0.0016,
    },
    "embedding": {
        "ada": 0.0004
    }
}

def get_price(text: str, model: str="davinci", task: str="completion") -> float:
    return count_tokens(text) * prices[task][model] / 1000