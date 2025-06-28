;; Capture the variable/function name
(variable_declarator
  name: (identifier) @function.name
  type: (type_annotation
    (function_type) @function.type))

;; Capture the full parameter list
(function_type
  parameters: (formal_parameters) @function.params)

;; Capture the type identifiers used in the parameters
(formal_parameters
  (required_parameter
    type: (type_annotation
      (type_identifier) @param.type))
  (required_parameter
    type: (type_annotation
      (type_identifier) @param.type)))

;; Capture the return type of the function
(function_type
  return_type: (type_identifier) @return.type)

;; Capture any parse errors (e.g., the `??`)
(ERROR) @error.node

;; Capture the entire function declaration line
(lexical_declaration) @function.decl

;; Matches import declarations like: import { A, B } from "module";
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @import.name)))
  source: (string) @import.source)
