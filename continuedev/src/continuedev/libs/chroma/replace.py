import sys
from llama_index import GPTVectorStoreIndex, Document


def replace_additional_index(info: str):
    """Replace the additional index."""
    with open('data/additional_context.txt', 'w') as f:
        f.write(info)
    documents = [Document(info)]
    index = GPTVectorStoreIndex(documents)
    index.save_to_disk('data/additional_index.json')
    print("Additional index replaced")


if __name__ == "__main__":
    """python3 replace.py <info>"""
    info = sys.argv[1] if len(sys.argv) > 1 else None
    if info:
        replace_additional_index(info)
