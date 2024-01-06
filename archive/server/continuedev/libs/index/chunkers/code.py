from typing import List, Union
from .chunk import ChunkWithoutID
from tree_sitter_languages import get_parser
from tree_sitter import Node
from ...util.count_tokens import count_tokens

file_extension_to_language = {
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
    "java": "java",
    "go": "go",
    "rb": "ruby",
    "rs": "rust",
    "c": "c",
    "cpp": "cpp",
    "cs": "c_sharp",
    "php": "php",
    "scala": "scala",
    "swift": "swift",
    "kt": "kotlin",
}


def get_parser_for_file(filepath: str):
    ext = filepath.split(".")[-1]
    if lang := file_extension_to_language.get(ext):
        return get_parser(lang)

    raise Exception(f"Could not find language for file {filepath}")


def get_all_nodes(node: Node):
    yield node
    for child in node.children:
        yield from get_all_nodes(child)


def first_child(node: Node, grammar_name: Union[str, List[str]]):
    if isinstance(grammar_name, list):
        return next(
            filter(lambda x: x.grammar_name in grammar_name, node.children), None
        )
    return next(filter(lambda x: x.grammar_name == grammar_name, node.children), None)


# TODO: This should actually happen a level up. Given the whole function, return `def f():\n\t...` for example
def collapsed_replacement(node: Node):
    if node.grammar_name == "statement_block":
        return "{ ... }"
    else:
        return "..."


def collapse_children(
    node: Node,
    code: str,
    block_types: List[str],
    collapse_types: List[str],
    collapse_block_types: List[str],
) -> str:
    code = code[: node.end_byte]
    if block := first_child(node, block_types):
        for child in reversed(
            list(
                filter(
                    lambda x: x.grammar_name in collapse_types,
                    block.children,
                )
            )
        ):
            if grand_child := first_child(child, collapse_block_types):
                start = grand_child.start_byte
                end = grand_child.end_byte
                code = code[:start] + collapsed_replacement(grand_child) + code[end:]

    return code[node.start_byte :]


def construct_class_definition_chunk(node: Node, code):
    return collapse_children(
        node,
        code,
        ["block", "class_body", "declaration_list"],
        ["method_definition", "function_definition", "function_item"],
        ["block", "statement_block"],
    )


def construct_function_definition_chunk(node: Node, code) -> str:
    func_text = node.text.decode("utf8")
    if (
        node.parent
        and node.parent.grammar_name in ["block", "declaration_list"]
        and node.parent.parent
        and node.parent.parent.grammar_name in ["class_definition", "impl_item"]
    ):
        # If inside a class, include the class header
        class_node = node.parent.parent
        class_block = node.parent

        return (
            code[class_node.start_byte : class_block.start_byte]
            + "...\n\n"
            + (" " * node.start_point[1])
            + func_text
        )

    return func_text


collapsed_node_constructors = {
    # Classes, structs, etc
    "class_definition": construct_class_definition_chunk,
    "class_declaration": construct_class_definition_chunk,
    "impl_item": construct_class_definition_chunk,
    # Functions
    "function_definition": construct_function_definition_chunk,
    "function_declaration": construct_function_definition_chunk,
    "function_item": construct_function_definition_chunk,
}


def get_smart_collapsed_chunks(
    node: Node, code: str, max_chunk_size: int, root: bool = True
) -> List[ChunkWithoutID]:
    # Keep entire text if not over size
    if (root or node.grammar_name in collapsed_node_constructors) and count_tokens(
        node.text.decode("utf8")
    ) < max_chunk_size:
        yield ChunkWithoutID(
            content=node.text.decode("utf8"),
            start_line=node.start_point[0],
            end_line=node.end_point[0],
        )
        return

    # If a collapsed form is defined, use that
    if node.grammar_name in collapsed_node_constructors:
        yield ChunkWithoutID(
            content=collapsed_node_constructors[node.grammar_name](node, code),
            start_line=node.start_point[0],
            end_line=node.end_point[0],
        )
        # TODO - if this is still too large, what can you do?

    # TODO: Should try to group elements together from the top. If you can fit together multiple functions, that is prob ideal
    # But how to avoid separating a docstring from it's function for example?
    # Also find a metric to test against please!

    # Recurse (because even if collapsed version was shown, want to show the children in full somewhere)
    for child in node.children:
        yield from get_smart_collapsed_chunks(child, code, max_chunk_size, root=False)


def code_chunker(
    filepath: str, contents: str, max_chunk_size: int
) -> List[ChunkWithoutID]:
    if contents is None or len(contents.strip()) == 0:
        return []

    try:
        parser = get_parser_for_file(filepath)
    except Exception:
        return []

    tree = parser.parse(bytes(contents, "utf8"))

    return list(get_smart_collapsed_chunks(tree.root_node, contents, max_chunk_size))
