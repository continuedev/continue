import os
from typing import List, Tuple


def dedent_and_get_common_whitespace(s: str) -> Tuple[str, str]:
    lines = s.splitlines()
    if len(lines) == 0:
        return "", ""

    # Longest common whitespace prefix
    lcp = lines[0].split(lines[0].strip())[0]
    # Iterate through the lines
    for i in range(1, len(lines)):
        # Empty lines are wildcards
        if lines[i].strip() == "":
            continue  # hey that's us!
        # Iterate through the leading whitespace characters of the current line
        for j in range(0, len(lcp)):
            # If it doesn't have the same whitespace as lcp, then update lcp
            if j >= len(lines[i]) or lcp[j] != lines[i][j]:
                lcp = lcp[:j]
                if lcp == "":
                    return s, ""
                break

    return "\n".join(map(lambda x: x.lstrip(lcp), lines)), lcp


def strip_code_block(s: str) -> str:
    """
    Strips the code block from a string, if it has one.
    """
    if s.startswith("```\n") and s.endswith("\n```"):
        return s[4:-4]
    elif s.startswith("```") and s.endswith("```"):
        return s[3:-3]
    elif s.startswith("`") and s.endswith("`"):
        return s[1:-1]
    return s


def remove_quotes_and_escapes(output: str) -> str:
    """
    Clean up the output of the completion API, removing unnecessary escapes and quotes
    """
    output = output.strip()

    # Replace smart quotes
    output = output.replace("“", '"')
    output = output.replace("”", '"')
    output = output.replace("‘", "'")
    output = output.replace("’", "'")

    # Remove escapes
    output = output.replace('\\"', '"')
    output = output.replace("\\'", "'")
    output = output.replace("\\n", "\n")
    output = output.replace("\\t", "\t")
    output = output.replace("\\\\", "\\")
    if (output.startswith('"') and output.endswith('"')) or (
        output.startswith("'") and output.endswith("'")
    ):
        output = output[1:-1]

    return output


def shorten_filepaths(filepaths: List[str]) -> List[str]:
    """
    Shortens the filepaths to just the filename,
    unless directory names are needed for uniqueness
    """
    basenames = list(map(os.path.basename, filepaths))
    if len(basenames) == len(filepaths):
        return list(basenames)

    basename_counts = {}
    for filepath in filepaths:
        basename = os.path.basename(filepath)
        if basename not in basename_counts:
            basename_counts[basename] = 0
        basename_counts[basename] += 1

    for i in range(0, len(filepaths)):
        basename = os.path.basename(filepaths[i])
        if basename_counts[basename] <= 1:
            filepaths[i] = basename
        else:
            filepaths[i] = os.path.join(
                os.path.basename(os.path.dirname(filepaths[i])), basename
            )

    return filepaths
