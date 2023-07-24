import os
import chevron


def get_vars_in_template(template):
    """
    Get the variables in a template
    """
    return [token[1] for token in chevron.tokenizer.tokenize(template) if token[0] == 'variable']


def escape_var(var: str) -> str:
    """
    Escape a variable so it can be used in a template
    """
    return var.replace(os.path.sep, '').replace('.', '')


def render_templated_string(template: str) -> str:
    """
    Render system message or other templated string with mustache syntax.
    Right now it only supports rendering absolute file paths as their contents.
    """
    vars = get_vars_in_template(template)

    args = {}
    for var in vars:
        if var.startswith(os.path.sep):
            # Escape vars which are filenames, because mustache doesn't allow / in variable names
            escaped_var = escape_var(var)
            template = template.replace(
                var, escaped_var)

            if os.path.exists(var):
                args[escaped_var] = open(var, 'r').read()
            else:
                args[escaped_var] = ''

    return chevron.render(template, args)
