---
globs: /**/*.{py,ipynb}
description: Clean Tensor Dimension Annotation
---

# Tensor Dimension Annotation

The goal is to help developers easily read, understand, and debug code in pytorch and JAX code where tensor computation plays a major role.

- Import the typing and jaxtyping libraries and use them throughout according to their best practices (i.e., in a very pythonic way)
- Explicitly include the type of each function argument wherever it is possible to determine, e.g. `image: np.ndarray`
- Explicitly include the return type of each function wherever it is possible to determine, e.g. `def get_x(): -> int:`
- Include jaxtyping annotations of tensor dimensions for all tensor arguments to functions, wherever the dimensions are possible to determine. If the numeric values are unclear, use symbolic notation like "batch", "channel", "height", or "width". Create and use these symbolic dimensions in such a way that they are consistent, semantically meaningful, short, and human-readable. If einops is used, ensure that the symbolic values used there are the same as for the dimension annotations.
- Ensure that the dimension annotations are just strict enough to hold up to all edge cases.
- In the docstring of every function where tensor dimensions play a major role in the computation, incorporate a very short but detailed rationale for the input tensor dimensions. There is no need to do this for very simple functions.
- If it is possible to determine and would assist with readability, include annotations for the tensor dimensions of function outputs as well.
