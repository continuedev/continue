(
  (comment)? @comment
  (class_declaration
    name: (_) @name
  ) @definition
)

(
  (comment)? @comment
  (function_declaration
    name: (_) @name
    parameters: (_) @parameters
  ) @definition
)

(
  (comment)? @comment
  (method_definition
    name: (_) @name
    parameters: (_) @parameters
  ) @definition
)

(
  (comment)? @comment
  (interface_declaration
    name: (_) @name) @definition
) 
