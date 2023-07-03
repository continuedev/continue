from typing import Tuple


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
            continue
        # Iterate through the leading whitespace characters of the current line
        for j in range(0, len(lcp)):
            # If it doesn't have the same whitespace as lcp, then update lcp
            if j >= len(lines[i]) or lcp[j] != lines[i][j]:
                lcp = lcp[:j]
                if lcp == "":
                    return s, ""
                break
    return "\n".join(map(lambda x: x.removeprefix(lcp), lines)), lcp
