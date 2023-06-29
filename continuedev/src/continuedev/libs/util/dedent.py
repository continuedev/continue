from typing import Tuple


def dedent_and_get_common_whitespace(s: str) -> Tuple[str, str]:
    lines = s.splitlines()

    # Longest common whitespace prefix
    lcp = lines[0].split(lines[0].strip())[0]
    for i in range(1, len(lines)):
        for j in range(0, len(lcp)):
            if j >= len(lines[i]) or lcp[j] != lines[i][j]:
                lcp = lcp[:j]
                if lcp == "":
                    return s, ""
                break
    return "\n".join(map(lambda x: x.removeprefix(lcp), lines)), lcp
