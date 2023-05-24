from .llm import LLM
from transformers import AutoTokenizer, AutoModelForCausalLM

class HuggingFace(LLM):
    def __init__(self, model_path: str = "Salesforce/codegen-2B-mono"):
        self.model_path = model_path
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForCausalLM.from_pretrained(model_path)
    
    def complete(self, prompt: str, **kwargs):
        args = { "max_tokens": 100 } | kwargs
        input_ids = self.tokenizer(prompt, return_tensors="pt").input_ids
        generated_ids = self.model.generate(input_ids, max_length=args["max_tokens"])
        return self.tokenizer.decode(generated_ids[0], skip_special_tokens=True)